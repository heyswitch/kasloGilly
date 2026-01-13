import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { hasCommandPermission, getConfig } from '../config';
import {
  deleteShiftsForUserInCycle,
  deleteShiftsForUnitInCycle,
  deleteAllShiftsInCycle,
  getActiveQuotaCycle,
  addAuditLog
} from '../database/database';
import { logAuditAction } from '../services/shiftLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset_quota')
    .setDescription('Reset activity quota data (Command role only)')
    .addStringOption(option =>
      option
        .setName('target')
        .setDescription('What to reset: unit name, @user, or "all"')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    // Check command permissions
    if (!hasCommandPermission(memberRoleIds)) {
      return interaction.editReply('❌ You do not have permission to use this command. Only command staff can reset quotas.');
    }

    const target = interaction.options.getString('target', true);
    const activeQuotaCycle = getActiveQuotaCycle();

    if (!activeQuotaCycle) {
      return interaction.editReply('❌ No active quota cycle found.');
    }

    // Create confirmation buttons
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_reset')
      .setLabel('Yes, Reset')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_reset')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    let confirmMessage = '';
    if (target.toLowerCase() === 'all') {
      confirmMessage = '⚠️ **WARNING:** This will reset activity data for **ALL USERS** in the current cycle.\n\nAre you sure you want to continue?';
    } else if (target.startsWith('<@') && target.endsWith('>')) {
      const userId = target.replace(/[<@!>]/g, '');
      confirmMessage = `⚠️ This will reset activity data for <@${userId}> in the current cycle.\n\nAre you sure?`;
    } else {
      confirmMessage = `⚠️ This will reset activity data for all members of **${target}** in the current cycle.\n\nAre you sure?`;
    }

    const response = await interaction.editReply({
      content: confirmMessage,
      components: [row]
    });

    // Wait for button click
    try {
      const confirmation = await response.awaitMessageComponent({
        filter: i => i.user.id === interaction.user.id,
        componentType: ComponentType.Button,
        time: 30000
      });

      if (confirmation.customId === 'cancel_reset') {
        await confirmation.update({ content: '❌ Reset cancelled.', components: [] });
        return;
      }

      // Perform reset
      let deletedCount = 0;
      let details = '';

      if (target.toLowerCase() === 'all') {
        deletedCount = deleteAllShiftsInCycle(activeQuotaCycle.id);
        details = `Reset all quota data - ${deletedCount} shifts deleted`;
      } else if (target.startsWith('<@') && target.endsWith('>')) {
        const userId = target.replace(/[<@!>]/g, '');
        deletedCount = deleteShiftsForUserInCycle(userId, activeQuotaCycle.id);
        details = `Reset quota data for user ${target} - ${deletedCount} shifts deleted`;
      } else {
        const config = getConfig();
        if (!config.unitRoles[target]) {
          await confirmation.update({
            content: `❌ Invalid unit role. Available units: ${Object.keys(config.unitRoles).join(', ')}`,
            components: []
          });
          return;
        }
        deletedCount = deleteShiftsForUnitInCycle(target, activeQuotaCycle.id);
        details = `Reset quota data for ${target} - ${deletedCount} shifts deleted`;
      }

      // Log audit
      addAuditLog(
        interaction.user.id,
        interaction.user.username,
        'RESET_QUOTA',
        null,
        details
      );

      await logAuditAction(interaction.client, interaction.user.username, 'RESET_QUOTA', details);

      await confirmation.update({
        content: `✅ Successfully reset quota data!\n\n**Deleted:** ${deletedCount} shift record(s)`,
        components: []
      });
    } catch (error) {
      await interaction.editReply({
        content: '❌ Confirmation timed out. Reset cancelled.',
        components: []
      });
    }
  },
};
