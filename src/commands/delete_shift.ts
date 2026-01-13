import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { hasSupervisorPermission } from '../config';
import { deleteShift, addAuditLog } from '../database/database';
import { logAuditAction } from '../services/shiftLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete_shift')
    .setDescription('Delete a shift record (Supervisor role only)')
    .addIntegerOption(option =>
      option
        .setName('shift_id')
        .setDescription('The shift ID to delete')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for deleting the shift')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    // Check supervisor permissions
    if (!hasSupervisorPermission(memberRoleIds)) {
      return interaction.editReply('❌ You do not have permission to use this command. Only supervisors can delete shifts.');
    }

    const shiftId = interaction.options.getInteger('shift_id', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Create confirmation buttons
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_delete')
      .setLabel('Yes, Delete')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_delete')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    const response = await interaction.editReply({
      content: `⚠️ Are you sure you want to delete shift #${shiftId}?\n\n**Reason:** ${reason}\n\nThis action cannot be undone.`,
      components: [row]
    });

    // Wait for button click
    try {
      const confirmation = await response.awaitMessageComponent({
        filter: i => i.user.id === interaction.user.id,
        componentType: ComponentType.Button,
        time: 30000
      });

      if (confirmation.customId === 'cancel_delete') {
        await confirmation.update({ content: '❌ Deletion cancelled.', components: [] });
        return;
      }

      // Delete shift
      const success = deleteShift(shiftId);

      if (!success) {
        await confirmation.update({
          content: '❌ Failed to delete shift. Please check the shift ID and try again.',
          components: []
        });
        return;
      }

      // Log audit
      const details = `Deleted shift #${shiftId} - Reason: ${reason}`;
      addAuditLog(
        interaction.user.id,
        interaction.user.username,
        'DELETE_SHIFT',
        null,
        details
      );

      await logAuditAction(interaction.client, interaction.user.username, 'DELETE_SHIFT', details);

      await confirmation.update({
        content: `✅ Successfully deleted shift #${shiftId}.\n\n**Reason:** ${reason}`,
        components: []
      });
    } catch (error) {
      await interaction.editReply({
        content: '❌ Confirmation timed out. Deletion cancelled.',
        components: []
      });
    }
  },
};
