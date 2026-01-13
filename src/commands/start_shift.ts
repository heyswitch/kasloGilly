import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { getUserUnitRoles, hasEmployeePermission } from '../config';
import { getActiveShiftForUser, startShift, getActiveQuotaCycle } from '../database/database';
import { isValidUrl } from '../utils/timeFormatter';
import { logShiftStart } from '../services/shiftLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start_shift')
    .setDescription('Start your patrol shift')
    .addStringOption(option =>
      option
        .setName('picture_link')
        .setDescription('Link to your start shift picture proof')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const pictureLink = interaction.options.getString('picture_link', true);
    const member = interaction.member as GuildMember;

    // Check employee permissions
    const memberRoleIds = member.roles.cache.map(role => role.id);
    if (!hasEmployeePermission(memberRoleIds)) {
      return interaction.editReply('❌ You do not have permission to use this command. Only employees of the department can start shifts.');
    }

    // Validate picture link
    if (!isValidUrl(pictureLink)) {
      return interaction.editReply('❌ Invalid picture link. Please provide a valid URL.');
    }

    // Get user's unit roles
    const unitRoles = getUserUnitRoles(memberRoleIds);

    if (unitRoles.length === 0) {
      return interaction.editReply('❌ You do not have any unit roles assigned. Please contact an administrator.');
    }

    // Check if user already has an active shift
    const activeShift = getActiveShiftForUser(interaction.user.id);
    if (activeShift) {
      return interaction.editReply('❌ You already have an active shift. Please end it before starting a new one.');
    }

    // Get active quota cycle
    const activeQuotaCycle = getActiveQuotaCycle();
    if (!activeQuotaCycle) {
      return interaction.editReply('❌ No active quota cycle found. Please contact an administrator.');
    }

    // Use the first unit role (primary unit)
    const primaryUnit = unitRoles[0];

    // Start the shift
    const shift = startShift(
      interaction.user.id,
      interaction.user.username,
      primaryUnit,
      pictureLink,
      activeQuotaCycle.id
    );

    // Log to shift log channel
    await logShiftStart(interaction.client, shift);

    return interaction.editReply(`✅ Shift started for **${primaryUnit}**!\n\nYour time is now being tracked. Use \`/end_shift\` when you're done.`);
  },
};
