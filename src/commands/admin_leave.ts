import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasSupervisorPermission, getTerminology } from '../config';
import {
  createDepartmentAction,
  getActiveLeaveForUser,
  addAuditLog,
  updateDepartmentActionMessageId
} from '../database/database';
import { logDepartmentAction } from '../services/departmentLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin_leave')
    .setDescription('Place a member on Administrative Leave (indefinite)')
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription('The Roblox username to place on Administrative Leave')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('notes')
        .setDescription('Additional notes for this Administrative Leave')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.editReply('This command can only be used in a server.');
    }

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    const terms = getTerminology(guildId);

    if (!hasSupervisorPermission(memberRoleIds, guildId)) {
      return interaction.editReply(
        `You do not have permission to use this command. Only supervisors and above can place members on ${terms.adminLeave}.`
      );
    }

    const username = interaction.options.getString('username', true);
    const notes = interaction.options.getString('notes');
    const targetUserId = `roblox_${username.toLowerCase()}`;

    // Check if user already has active leave
    const existingLeave = getActiveLeaveForUser(guildId, targetUserId);
    if (existingLeave) {
      const existingType = existingLeave.actionType === 'LOA' ? terms.loa : terms.adminLeave;
      return interaction.editReply(
        `**${username}** is already on ${existingType}.`
      );
    }

    // Create the Administrative Leave
    const action = createDepartmentAction(guildId, {
      actionType: 'ADMIN_LEAVE',
      targetUserId: targetUserId,
      targetUsername: username,
      adminUserId: interaction.user.id,
      adminUsername: interaction.user.username,
      notes: notes || undefined
    });

    // Log to channel
    const messageId = await logDepartmentAction(interaction.client, guildId, action);
    if (messageId) {
      updateDepartmentActionMessageId(guildId, action.id, messageId);
    }

    // Audit log
    addAuditLog(
      guildId,
      interaction.user.id,
      interaction.user.username,
      'ADMIN_LEAVE_CREATE',
      targetUserId,
      `Placed ${username} on ${terms.adminLeave}`
    );

    return interaction.editReply(
      `Successfully placed **${username}** on ${terms.adminLeave}.`
    );
  }
};
