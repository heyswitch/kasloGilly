import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, EmbedBuilder } from 'discord.js';
import { hasSupervisorPermission, getConfig, getQuotaForUnit, getNextQuotaCycleEnd } from '../config';
import { getUnitShiftsInCycle, getActiveQuotaCycle, getTotalMinutesForUserInCycle } from '../database/database';
import { formatDuration, formatDateForCycleEnd } from '../utils/timeFormatter';
import { UserQuotaStats } from '../types';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('activity_report')
    .setDescription('Generate activity report for a unit (Supervisor role only)')
    .addStringOption(option =>
      option
        .setName('unit_role')
        .setDescription('The unit role to generate report for')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    // Check supervisor permissions
    if (!hasSupervisorPermission(memberRoleIds)) {
      await interaction.editReply('❌ You do not have permission to use this command. Only supervisors can view activity reports.');
      // Delete the error message after 5 seconds to keep channel clean
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {
          // Ignore if message was already deleted
        }
      }, 5000);
      return;
    }

    const unitRole = interaction.options.getString('unit_role', true);
    const config = getConfig();

    // Validate unit role
    if (!config.unitRoles[unitRole]) {
      await interaction.editReply(`❌ Invalid unit role. Available units: ${Object.keys(config.unitRoles).join(', ')}`);
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {
          // Ignore if message was already deleted
        }
      }, 10000);
      return;
    }

    const activeQuotaCycle = getActiveQuotaCycle();
    if (!activeQuotaCycle) {
      await interaction.editReply('❌ No active quota cycle found.');
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {
          // Ignore if message was already deleted
        }
      }, 5000);
      return;
    }

    // Get all shifts for this unit
    const shifts = getUnitShiftsInCycle(unitRole, activeQuotaCycle.id);

    if (shifts.length === 0) {
      await interaction.editReply(`📊 No activity data found for **${unitRole}** in the current cycle.`);
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {
          // Ignore if message was already deleted
        }
      }, 10000);
      return;
    }

    // Group shifts by user
    const userStats = new Map<string, UserQuotaStats>();

    for (const shift of shifts) {
      if (!userStats.has(shift.userId)) {
        const totalMinutes = getTotalMinutesForUserInCycle(shift.userId, activeQuotaCycle.id);
        const quotaMinutes = getQuotaForUnit(unitRole);

        userStats.set(shift.userId, {
          userId: shift.userId,
          username: shift.username,
          unitRole: shift.unitRole,
          totalMinutes,
          quotaMinutes,
          quotaMet: totalMinutes >= quotaMinutes,
          shifts: []
        });
      }
    }

    // Sort by total minutes (descending)
    const sortedStats = Array.from(userStats.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);

    // Calculate statistics
    const totalUsers = sortedStats.length;
    const usersMetQuota = sortedStats.filter(s => s.quotaMet).length;
    const quotaMinutes = getQuotaForUnit(unitRole);
    const cycleEnd = getNextQuotaCycleEnd();

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 Activity Report: ${unitRole}`)
      .setColor('#0099ff')
      .setDescription(
        `**Quota:** ${formatDuration(quotaMinutes)}\n` +
        `**Users Met Quota:** ${usersMetQuota}/${totalUsers} (${Math.round((usersMetQuota / totalUsers) * 100)}%)`
      )
      .setFooter({ text: `Activity cycle ends: ${formatDateForCycleEnd(cycleEnd)}` })
      .setTimestamp();

    // Add user stats (max 25 fields due to Discord limits)
    const maxUsers = 25;
    const displayUsers = sortedStats.slice(0, maxUsers);

    for (const stats of displayUsers) {
      const status = stats.quotaMet ? '✅' : '❌';
      const percentage = Math.min(Math.floor((stats.totalMinutes / stats.quotaMinutes) * 100), 100);

      embed.addFields({
        name: `${status} ${stats.username}`,
        value: `${formatDuration(stats.totalMinutes)} / ${formatDuration(stats.quotaMinutes)} (${percentage}%)`,
        inline: true
      });
    }

    if (sortedStats.length > maxUsers) {
      embed.addFields({
        name: 'Note',
        value: `Showing ${maxUsers} of ${totalUsers} users. Use /check_activity for individual reports.`,
        inline: false
      });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
