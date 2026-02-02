import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasSupervisorPermission } from '../config';
import { createDepartmentAction, addAuditLog, updateDepartmentActionMessageId } from '../database/database';
import { logDepartmentAction } from '../services/departmentLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hire')
    .setDescription('Log a new member hire/acceptance')
    .addStringOption(option =>
      option.setName('username').setDescription('The Roblox username being hired').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('notes').setDescription('Additional notes (e.g., External Hire, Transfer)').setRequired(false)
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
    const notes = interaction.options.getString('notes');
    const targetUserId = `roblox_${username.toLowerCase()}`;

    // Create the hire record
    const action = createDepartmentAction(guildId, {
      actionType: 'HIRE',
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
      'HIRE',
      targetUserId,
      `Hired ${username}${notes ? ` - ${notes}` : ''}`
    );

    return interaction.editReply(`Successfully logged hire for **${username}**.`);
  }
};
