import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasSupervisorPermission, getTerminology } from '../config';
import {
  createDepartmentAction,
  getActiveLeaveForUser,
  addAuditLog,
  updateDepartmentActionMessageId
} from '../database/database';
import { logDepartmentAction } from '../services/departmentLogger';

function parseEndDate(input: string): Date | null {
  // Try MM/DD/YYYY format
  const slashMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1]) - 1;
    const day = parseInt(slashMatch[2]);
    const year = parseInt(slashMatch[3]);
    const date = new Date(year, month, day, 23, 59, 59);
    if (!isNaN(date.getTime())) return date;
  }

  // Try YYYY-MM-DD format
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const date = new Date(input + 'T23:59:59');
    if (!isNaN(date.getTime())) return date;
  }

  // Try relative formats ("2 weeks", "1 month", "3 days", etc.)
  const relativeMatch = input.match(/^(\d+)\s*(day|week|month)s?$/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const date = new Date();
    date.setHours(23, 59, 59, 0);

    switch (unit) {
      case 'day':
        date.setDate(date.getDate() + amount);
        break;
      case 'week':
        date.setDate(date.getDate() + amount * 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() + amount);
        break;
    }

    return date;
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ztp')
    .setDescription('Issue a Zero Tolerance Policy action to a member')
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription('The Roblox username to issue ZTP to')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('end_date')
        .setDescription('When the ZTP ends (MM/DD/YYYY, YYYY-MM-DD, or "2 weeks")')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('notes')
        .setDescription('Additional notes for this ZTP action')
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
        `You do not have permission to use this command. Only supervisors and above can issue ${terms.ztp} actions.`
      );
    }

    const username = interaction.options.getString('username', true);
    const endDateStr = interaction.options.getString('end_date', true);
    const notes = interaction.options.getString('notes');
    const targetUserId = `roblox_${username.toLowerCase()}`;

    // Parse end date
    const endDate = parseEndDate(endDateStr);
    if (!endDate) {
      return interaction.editReply(
        'Invalid date format. Use MM/DD/YYYY, YYYY-MM-DD, or relative like "2 weeks".'
      );
    }

    // Check if date is in the past
    if (endDate.getTime() < Date.now()) {
      return interaction.editReply('The end date cannot be in the past.');
    }

    // Check if user already has active leave
    const existingLeave = getActiveLeaveForUser(guildId, targetUserId);
    if (existingLeave) {
      const existingType = existingLeave.actionType === 'LOA' ? terms.loa :
                          existingLeave.actionType === 'ADMIN_LEAVE' ? terms.adminLeave :
                          existingLeave.actionType === 'PROBATION' ? terms.probation :
                          existingLeave.actionType === 'SUSPENSION' ? terms.suspension :
                          terms.ztp;
      return interaction.editReply(
        `**${username}** is already on ${existingType}.`
      );
    }

    // Create the ZTP action
    const action = createDepartmentAction(guildId, {
      actionType: 'ZTP',
      targetUserId: targetUserId,
      targetUsername: username,
      adminUserId: interaction.user.id,
      adminUsername: interaction.user.username,
      notes: notes || undefined,
      endDate: endDate.getTime()
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
      'ZTP_CREATE',
      targetUserId,
      `Issued ${terms.ztp} to ${username} until ${endDate.toLocaleDateString()}`
    );

    return interaction.editReply(
      `Successfully issued **${terms.ztp}** to **${username}** until <t:${Math.floor(endDate.getTime() / 1000)}:D>.`
    );
  }
};
