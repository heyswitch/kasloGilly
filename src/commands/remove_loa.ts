import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasSupervisorPermission, getTerminology } from '../config';
import { getActiveLeaveForUser, removeDepartmentLeave, addAuditLog } from '../database/database';
import { logLeaveRemoval } from '../services/departmentLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove_loa')
    .setDescription('Remove a member from LOA, Administrative Leave, Probation, Suspension, or ZTP')
    .addStringOption(option =>
      option.setName('username').setDescription('The Roblox username to remove from leave/status').setRequired(true)
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
      return interaction.editReply('You do not have permission to use this command.');
    }

    const username = interaction.options.getString('username', true);
    const targetUserId = `roblox_${username.toLowerCase()}`;

    // Check if user has active leave
    const activeLeave = getActiveLeaveForUser(guildId, targetUserId);
    if (!activeLeave) {
      return interaction.editReply(`**${username}** is not currently on any leave.`);
    }

    const terms = getTerminology(guildId);

    // Remove the leave
    removeDepartmentLeave(guildId, activeLeave.id, interaction.user.id, interaction.user.username);

    // Log the removal
    activeLeave.removedAt = Date.now();
    activeLeave.removedByUserId = interaction.user.id;
    activeLeave.removedByUsername = interaction.user.username;
    await logLeaveRemoval(interaction.client, guildId, activeLeave, false);

    // Audit log
    const leaveType = activeLeave.actionType === 'LOA' ? terms.loa :
                     activeLeave.actionType === 'ADMIN_LEAVE' ? terms.adminLeave :
                     activeLeave.actionType === 'PROBATION' ? terms.probation :
                     activeLeave.actionType === 'SUSPENSION' ? terms.suspension :
                     terms.ztp;
    addAuditLog(
      guildId,
      interaction.user.id,
      interaction.user.username,
      'LOA_REMOVE',
      targetUserId,
      `Removed ${username} from ${leaveType}`
    );

    return interaction.editReply(`Successfully removed **${username}** from ${leaveType}.`);
  }
};
