import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasSupervisorPermission } from '../config';
import { updateShiftDurationByCode, getShiftByCode, addAuditLog } from '../database/database';
import { logAuditAction } from '../services/shiftLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit_shift')
    .setDescription('Edit shift duration (Supervisor role only)')
    .addStringOption(option =>
      option
        .setName('shift_code')
        .setDescription('The shift code to edit (e.g., ABC12345)')
        .setRequired(true)
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

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.editReply('❌ This command can only be used in a server.');
    }

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    // Check supervisor permissions
    if (!hasSupervisorPermission(memberRoleIds, guildId)) {
      return interaction.editReply('❌ You do not have permission to use this command. Only supervisors can edit shifts.');
    }

    const shiftCode = interaction.options.getString('shift_code', true).toUpperCase();
    const newMinutes = interaction.options.getInteger('new_minutes', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Verify shift exists
    const shift = getShiftByCode(guildId, shiftCode);
    if (!shift) {
      return interaction.editReply(`❌ No shift found with code **${shiftCode}**. Please check the shift code and try again.`);
    }

    // Update shift
    const success = updateShiftDurationByCode(guildId, shiftCode, newMinutes);

    if (!success) {
      return interaction.editReply('❌ Failed to update shift. Please try again.');
    }

    // Log audit
    const details = `Edited shift ${shiftCode} (User: ${shift.username}) - New duration: ${newMinutes} minutes - Reason: ${reason}`;
    addAuditLog(
      guildId,
      interaction.user.id,
      interaction.user.username,
      'EDIT_SHIFT',
      shift.userId,
      details
    );

    await logAuditAction(interaction.client, guildId, interaction.user.username, 'EDIT_SHIFT', details);

    return interaction.editReply(`✅ Successfully updated shift **${shiftCode}** to **${newMinutes} minutes**.\n\n**User:** ${shift.username}\n**Reason:** ${reason}`);
  },
};
