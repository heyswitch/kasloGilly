import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getActiveShiftForUser, endShift } from '../database/database';
import { isValidUrl } from '../utils/timeFormatter';
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

    const pictureLink = interaction.options.getString('picture_link', true);

    // Validate picture link
    if (!isValidUrl(pictureLink)) {
      return interaction.editReply('❌ Invalid picture link. Please provide a valid URL.');
    }

    // Check if user has an active shift
    const activeShift = getActiveShiftForUser(interaction.user.id);
    if (!activeShift) {
      return interaction.editReply('❌ You do not have an active shift. Use `/start_shift` to start one.');
    }

    // End the shift
    const endedShift = endShift(activeShift.id, pictureLink);

    if (!endedShift) {
      return interaction.editReply('❌ Failed to end shift. Please try again.');
    }

    // Log to shift log channel
    await logShiftEnd(interaction.client, endedShift);

    return interaction.editReply(`✅ Shift ended!\n\n**Duration:** ${Math.floor(endedShift.durationMinutes!)} minutes\n\nThank you for your service!`);
  },
};
