import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasSupervisorPermission } from '../config';
import { updateShiftDuration, addAuditLog } from '../database/database';
import { logAuditAction } from '../services/shiftLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit_shift')
    .setDescription('Edit shift duration (Supervisor role only)')
    .addIntegerOption(option =>
      option
        .setName('shift_id')
        .setDescription('The shift ID to edit')
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption(option =>
      option
        .setName('new_minutes')
        .setDescription('The new duration in minutes')
        .setRequired(true)
        .setMinValue(0)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for editing the shift')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    // Check supervisor permissions
    if (!hasSupervisorPermission(memberRoleIds)) {
      return interaction.editReply('❌ You do not have permission to use this command. Only supervisors can edit shifts.');
    }

    const shiftId = interaction.options.getInteger('shift_id', true);
    const newMinutes = interaction.options.getInteger('new_minutes', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Update shift
    const success = updateShiftDuration(shiftId, newMinutes);

    if (!success) {
      return interaction.editReply('❌ Failed to update shift. Please check the shift ID and try again.');
    }

    // Log audit
    const details = `Edited shift #${shiftId} - New duration: ${newMinutes} minutes - Reason: ${reason}`;
    addAuditLog(
      interaction.user.id,
      interaction.user.username,
      'EDIT_SHIFT',
      null,
      details
    );

    await logAuditAction(interaction.client, interaction.user.username, 'EDIT_SHIFT', details);

    return interaction.editReply(`✅ Successfully updated shift #${shiftId} to **${newMinutes} minutes**.\n\n**Reason:** ${reason}`);
  },
};
