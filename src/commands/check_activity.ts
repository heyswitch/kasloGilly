import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { getUserShiftsInCycle, getActiveQuotaCycle, getTotalMinutesForUserInCycle } from '../database/database';
import { formatDuration, formatShortTimestamp, formatDateForCycleEnd } from '../utils/timeFormatter';
import { getQuotaForUnit, getNextQuotaCycleEnd, hasEmployeePermission, hasSupervisorPermission } from '../config';

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

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.editReply('❌ This command can only be used in a server.');
    }

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    // Check employee permissions
    if (!hasEmployeePermission(memberRoleIds, guildId)) {
      return interaction.editReply('❌ You do not have permission to use this command. Only employees of the department can check activity.');
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;

    // If user is not a supervisor, they can only check their own activity
    if (!hasSupervisorPermission(memberRoleIds, guildId) && targetUser.id !== interaction.user.id) {
      return interaction.editReply('❌ You can only check your own activity. Supervisors can check other users\' activity.');
    }

    const activeQuotaCycle = getActiveQuotaCycle(guildId);

    if (!activeQuotaCycle) {
      return interaction.editReply('❌ No active quota cycle found. Please contact an administrator.');
    }

    // Get all shifts for the user in the current cycle
    const shifts = getUserShiftsInCycle(guildId, targetUser.id, activeQuotaCycle.id);

    // Get server nickname
    let displayName = targetUser.username;
    try {
      const targetMember = await interaction.guild?.members.fetch(targetUser.id);
      if (targetMember) {
        displayName = targetMember.displayName;
      }
    } catch {
      // Fall back to username if member fetch fails
    }

    if (shifts.length === 0) {
      return interaction.editReply(`📊 **${displayName}** has no recorded shifts in the current activity cycle.`);
    }

    // Calculate total minutes
    const totalMinutes = getTotalMinutesForUserInCycle(guildId, targetUser.id, activeQuotaCycle.id);
    const unitRole = shifts[0].unitRole;
    const quotaMinutes = getQuotaForUnit(unitRole, guildId);
    const quotaMet = totalMinutes >= quotaMinutes;
    const cycleEnd = getNextQuotaCycleEnd(guildId);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 Activity Report: ${displayName}`)
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
      // Determine accurate status
      let status: string;
      let duration: string;

      if (shift.isActive) {
        status = '🟢 Active';
        duration = 'In Progress';
      } else if (shift.durationMinutes !== null && shift.durationMinutes !== undefined) {
        status = '🔴 Ended';
        duration = formatDuration(shift.durationMinutes);
      } else {
        // Handle edge case: shift marked as inactive but no duration calculated
        status = '⚠️ Ended (No Duration)';
        duration = 'Error';
      }

      return `${index + 1}. ${status} - ${formatShortTimestamp(shift.startTime)} - **${duration}** (Code: ${shift.shiftCode})`;
    }).join('\n');

    embed.addFields({ name: `Recent Shifts (${shifts.length} total)`, value: shiftHistory || 'None', inline: false });

    return interaction.editReply({ embeds: [embed] });
  },
};
