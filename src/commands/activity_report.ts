import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { hasSupervisorPermission, getServerConfig, getQuotaForUnit, getNextQuotaCycleEnd } from '../config';
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
        .setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const focusedValue = interaction.options.getFocused().toLowerCase();
    const config = getServerConfig(guildId);
    const unitNames = Object.keys(config.unitRoles);

    const filtered = unitNames
      .filter(name => name.toLowerCase().includes(focusedValue))
      .slice(0, 25); // Discord limit

    await interaction.respond(
      filtered.map(name => ({ name, value: name }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.editReply('❌ This command can only be used in a server.');
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {
          // Ignore if message was already deleted
        }
      }, 5000);
      return;
    }

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    // Check supervisor permissions
    if (!hasSupervisorPermission(memberRoleIds, guildId)) {
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
    const config = getServerConfig(guildId);

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

    const activeQuotaCycle = getActiveQuotaCycle(guildId);
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
    const shifts = getUnitShiftsInCycle(guildId, unitRole, activeQuotaCycle.id);

    // Group shifts by user
    const userStats = new Map<string, UserQuotaStats>();

    // Build a set of current role members for filtering
    const currentRoleMembers = new Set<string>();
    const unitRoleIds = config.unitRoles[unitRole];
    if (unitRoleIds && interaction.guild) {
      for (const roleId of unitRoleIds) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) {
          for (const [memberId, member] of role.members) {
            currentRoleMembers.add(memberId);

            // Add all current members with the role (even if no shifts)
            if (!userStats.has(memberId)) {
              const totalMinutes = getTotalMinutesForUserInCycle(guildId, memberId, activeQuotaCycle.id);
              const quotaMinutes = getQuotaForUnit(unitRole, guildId);

              userStats.set(memberId, {
                userId: memberId,
                username: member.displayName,
                unitRole: unitRole,
                totalMinutes,
                quotaMinutes,
                quotaMet: totalMinutes >= quotaMinutes,
                shifts: []
              });
            }
          }
        }
      }
    }

    // Update display names for users who have shifts AND currently have the role
    for (const shift of shifts) {
      // Only include users who currently have the role
      if (currentRoleMembers.has(shift.userId) && userStats.has(shift.userId)) {
        // Display name already set from role.members above
        continue;
      }
    }

    // Sort by total minutes (descending)
    const sortedStats = Array.from(userStats.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);

    // If no users found at all
    if (sortedStats.length === 0) {
      await interaction.editReply(`📊 No users found with the **${unitRole}** role.`);
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {
          // Ignore if message was already deleted
        }
      }, 10000);
      return;
    }

    // Calculate statistics
    const totalUsers = sortedStats.length;
    const usersMetQuota = sortedStats.filter(s => s.quotaMet).length;
    const quotaMinutes = getQuotaForUnit(unitRole, guildId);
    const cycleEnd = getNextQuotaCycleEnd(guildId);

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
