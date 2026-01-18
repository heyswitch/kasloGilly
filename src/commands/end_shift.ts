import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasEmployeePermission } from '../config';
import { getActiveShiftForUser, endShift } from '../database/database';
import { isValidUrl, formatDuration } from '../utils/timeFormatter';
import { logShiftEnd } from '../services/shiftLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('end_shift')
    .setDescription('End your patrol shift')
    .addStringOption(option =>
      option
        .setName('picture_link')
        .setDescription('Link to your end shift picture proof')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.editReply('❌ This command can only be used in a server.');
    }

    const pictureLink = interaction.options.getString('picture_link', true);
    const member = interaction.member as GuildMember;

    // Check employee permissions
    const memberRoleIds = member.roles.cache.map(role => role.id);
    if (!hasEmployeePermission(memberRoleIds, guildId)) {
      return interaction.editReply('❌ You do not have permission to use this command. Only employees of the department can end shifts.');
    }

    // Validate picture link
    if (!isValidUrl(pictureLink)) {
      return interaction.editReply('❌ Invalid picture link. Please provide a valid URL.');
    }

    // Check if user has an active shift
    const activeShift = getActiveShiftForUser(guildId, interaction.user.id);
    if (!activeShift) {
      return interaction.editReply('❌ You do not have an active shift. Use `/start_shift` to start one.');
    }

    // End the shift
    const endedShift = endShift(guildId, activeShift.id, pictureLink);

    if (!endedShift) {
      return interaction.editReply('❌ Failed to end shift. Please try again.');
    }

    // Log to shift log channel
    await logShiftEnd(interaction.client, guildId, endedShift);

    return interaction.editReply(`✅ Shift ended!\n\n**Duration:** ${formatDuration(endedShift.durationMinutes!)}\n\nThank you for your service!`);
  },
};
