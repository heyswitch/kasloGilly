import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasSupervisorPermission, getTerminology } from '../config';
import {
  createDepartmentAction,
  addAuditLog,
  updateDepartmentActionMessageId
} from '../database/database';
import { logDepartmentAction } from '../services/departmentLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warning')
    .setDescription('Issue a warning to a member')
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription('The Roblox username to issue a warning to')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('notes')
        .setDescription('Reason for the warning')
        .setRequired(true)
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

    // Only supervisors can issue warnings
    if (!hasSupervisorPermission(memberRoleIds, guildId)) {
      return interaction.editReply(
        `You do not have permission to use this command. Only supervisors can issue warnings.`
      );
    }

    const username = interaction.options.getString('username', true);
    const notes = interaction.options.getString('notes', true);
    const targetUserId = `roblox_${username.toLowerCase()}`;

    // Create the warning
    const action = createDepartmentAction(guildId, {
      actionType: 'WARNING',
      targetUserId: targetUserId,
      targetUsername: username,
      adminUserId: interaction.user.id,
      adminUsername: interaction.user.username,
      notes: notes
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
      'WARNING_CREATE',
      targetUserId,
      `Issued ${terms.warning} to ${username}: ${notes}`
    );

    return interaction.editReply(
      `Successfully issued a **${terms.warning}** to **${username}**.\n\n**Reason:** ${notes}`
    );
  }
};
