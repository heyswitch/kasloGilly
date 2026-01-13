import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserShiftsInCycle, getActiveQuotaCycle, getTotalMinutesForUserInCycle } from '../database/database';
import { formatDuration, formatShortTimestamp, formatDateForCycleEnd } from '../utils/timeFormatter';
import { getQuotaForUnit, getNextQuotaCycleEnd } from '../config';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check_activity')
    .setDescription('Check activity logs for a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to check (leave empty to check yourself)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const activeQuotaCycle = getActiveQuotaCycle();

    if (!activeQuotaCycle) {
      return interaction.editReply('❌ No active quota cycle found. Please contact an administrator.');
    }

    // Get all shifts for the user in the current cycle
    const shifts = getUserShiftsInCycle(targetUser.id, activeQuotaCycle.id);

    if (shifts.length === 0) {
      return interaction.editReply(`📊 **${targetUser.username}** has no recorded shifts in the current activity cycle.`);
    }

    // Calculate total minutes
    const totalMinutes = getTotalMinutesForUserInCycle(targetUser.id, activeQuotaCycle.id);
    const unitRole = shifts[0].unitRole;
    const quotaMinutes = getQuotaForUnit(unitRole);
    const quotaMet = totalMinutes >= quotaMinutes;
    const cycleEnd = getNextQuotaCycleEnd();

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 Activity Report: ${targetUser.username}`)
      .setColor(quotaMet ? '#00FF00' : '#FF0000')
      .setDescription(`**Unit:** ${unitRole}\n**Quota Status:** ${quotaMet ? '✅ Met' : '❌ Not Met'}`)
      .addFields(
        { name: 'Total Time', value: formatDuration(totalMinutes), inline: true },
        { name: 'Required Time', value: formatDuration(quotaMinutes), inline: true },
        { name: 'Progress', value: `${Math.min(Math.floor((totalMinutes / quotaMinutes) * 100), 100)}%`, inline: true }
      )
      .setFooter({ text: `Activity cycle ends: ${formatDateForCycleEnd(cycleEnd)}` })
      .setTimestamp();

    // Add shift history (last 10 shifts)
    const recentShifts = shifts.slice(0, 10);
    const shiftHistory = recentShifts.map((shift, index) => {
      const status = shift.isActive ? '🟢 Active' : '🔴 Ended';
      const duration = shift.durationMinutes ? formatDuration(shift.durationMinutes) : 'In Progress';
      return `${index + 1}. ${status} - ${formatShortTimestamp(shift.startTime)} - **${duration}**`;
    }).join('\n');

    embed.addFields({ name: `Recent Shifts (${shifts.length} total)`, value: shiftHistory || 'None', inline: false });

    return interaction.editReply({ embeds: [embed] });
  },
};
