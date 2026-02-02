import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasSupervisorPermission } from '../config';
import { createDepartmentAction, addAuditLog, updateDepartmentActionMessageId } from '../database/database';
import { logDepartmentAction } from '../services/departmentLogger';
import { DischargeType } from '../types';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('discharge')
    .setDescription('Log a member discharge or resignation')
    .addStringOption(option =>
      option.setName('username').setDescription('The Roblox username being discharged').setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('The type of discharge')
        .setRequired(true)
        .addChoices(
          { name: 'Honorable Discharge', value: 'HONORABLE' },
          { name: 'Resignation', value: 'RESIGNATION' },
          { name: 'Termination', value: 'TERMINATION' }
        )
    )
    .addStringOption(option =>
      option.setName('notes').setDescription('Reason or additional notes').setRequired(false)
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
        'You do not have permission to use this command. Only supervisors can log discharges.'
      );
    }

    const username = interaction.options.getString('username', true);
    const dischargeType = interaction.options.getString('type', true) as DischargeType;
    const notes = interaction.options.getString('notes');
    const targetUserId = `roblox_${username.toLowerCase()}`;

    // Create the discharge record
    const action = createDepartmentAction(guildId, {
      actionType: 'DISCHARGE',
      targetUserId: targetUserId,
      targetUsername: username,
      adminUserId: interaction.user.id,
      adminUsername: interaction.user.username,
      notes: notes || undefined,
      dischargeType
    });

    // Log to channel
    const messageId = await logDepartmentAction(interaction.client, guildId, action);
    if (messageId) {
      updateDepartmentActionMessageId(guildId, action.id, messageId);
    }

    // Format discharge type for display
    const typeDisplay =
      dischargeType === 'HONORABLE'
        ? 'Honorable Discharge'
        : dischargeType === 'RESIGNATION'
          ? 'Resignation'
          : 'Termination';

    // Audit log
    addAuditLog(
      guildId,
      interaction.user.id,
      interaction.user.username,
      'DISCHARGE',
      targetUserId,
      `${username} - ${typeDisplay}`
    );

    return interaction.editReply(`Successfully logged **${typeDisplay}** for **${username}**.`);
  }
};
