import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasSupervisorPermission } from '../config';
import { createDepartmentAction, addAuditLog, updateDepartmentActionMessageId } from '../database/database';
import { logDepartmentAction } from '../services/departmentLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Log a member demotion')
    .addStringOption(option =>
      option.setName('username').setDescription('The Roblox username being demoted').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('new_rank').setDescription('The new rank').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('previous_rank').setDescription('The previous rank (optional)').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('notes').setDescription('Additional notes').setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.editReply('This command can only be used in a server.');
    }

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    if (!hasSupervisorPermission(memberRoleIds, guildId)) {
      return interaction.editReply(
        'You do not have permission to use this command. Only supervisors can log demotions.'
      );
    }

    const username = interaction.options.getString('username', true);
    const newRank = interaction.options.getString('new_rank', true);
    const previousRank = interaction.options.getString('previous_rank');
    const notes = interaction.options.getString('notes');
    const targetUserId = `roblox_${username.toLowerCase()}`;

    // Create the demotion record
    const action = createDepartmentAction(guildId, {
      actionType: 'DEMOTION',
      targetUserId: targetUserId,
      targetUsername: username,
      adminUserId: interaction.user.id,
      adminUsername: interaction.user.username,
      notes: notes || undefined,
      previousRank: previousRank || undefined,
      newRank
    });

    // Log to channel
    const messageId = await logDepartmentAction(interaction.client, guildId, action);
    if (messageId) {
      updateDepartmentActionMessageId(guildId, action.id, messageId);
    }

    // Audit log
    const details = previousRank
      ? `Demoted ${username} from ${previousRank} to ${newRank}`
      : `Demoted ${username} to ${newRank}`;

    addAuditLog(
      guildId,
      interaction.user.id,
      interaction.user.username,
      'DEMOTION',
      targetUserId,
      details
    );

    return interaction.editReply(`Successfully logged demotion for **${username}** to **${newRank}**.`);
  }
};
