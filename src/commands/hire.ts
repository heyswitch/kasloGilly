import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasSupervisorPermission } from '../config';
import { createDepartmentAction, addAuditLog, updateDepartmentActionMessageId } from '../database/database';
import { logDepartmentAction } from '../services/departmentLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hire')
    .setDescription('Log new member hire(s)/acceptance(s)')
    .addStringOption(option =>
      option.setName('username').setDescription('Roblox username(s) - separate multiple with commas (e.g., user1, user2, user3)').setRequired(true)
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

    const usernameInput = interaction.options.getString('username', true);
    const notes = interaction.options.getString('notes');

    // Parse multiple usernames (comma-separated)
    const usernames = usernameInput.split(',').map(u => u.trim()).filter(u => u.length > 0);

    if (usernames.length === 0) {
      return interaction.editReply('Please provide at least one valid username.');
    }

    const hiredUsers: string[] = [];
    const failedUsers: string[] = [];

    for (const username of usernames) {
      try {
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

        hiredUsers.push(username);
      } catch (error) {
        console.error(`Error hiring user ${username}:`, error);
        failedUsers.push(username);
      }
    }

    // Build response message
    let response = '';
    if (hiredUsers.length > 0) {
      if (hiredUsers.length === 1) {
        response = `Successfully logged hire for **${hiredUsers[0]}**.`;
      } else {
        response = `Successfully logged hires for **${hiredUsers.length}** users:\n${hiredUsers.map(u => `• ${u}`).join('\n')}`;
      }
    }
    if (failedUsers.length > 0) {
      response += `\n\nFailed to hire: ${failedUsers.join(', ')}`;
    }

    return interaction.editReply(response);
  }
};
