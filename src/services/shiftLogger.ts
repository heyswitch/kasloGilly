import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { Shift } from '../types';
import { formatTimestamp, formatDuration } from '../utils/timeFormatter';
import { getTotalMinutesForUserInCycle, getActiveQuotaCycle } from '../database/database';
import { getQuotaForUnit, getNextQuotaCycleEnd } from '../config';
import { formatDateForCycleEnd } from '../utils/timeFormatter';

export async function logShiftStart(client: Client, shift: Shift): Promise<void> {
  const channelId = process.env.SHIFT_LOG_CHANNEL_ID;
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('🟢 Shift Started')
      .setColor('#00FF00')
      .setDescription(`**${shift.username}** has started their shift`)
      .addFields(
        { name: 'Unit', value: shift.unitRole, inline: true },
        { name: 'Started At', value: formatTimestamp(shift.startTime), inline: true },
        { name: 'Picture Proof', value: `[View Image](${shift.startPictureLink})`, inline: false }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error logging shift start:', error);
  }
}

export async function logShiftEnd(client: Client, shift: Shift): Promise<void> {
  const channelId = process.env.SHIFT_LOG_CHANNEL_ID;
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId) as TextChannel;
    if (!channel) return;

    const activeQuotaCycle = getActiveQuotaCycle();
    if (!activeQuotaCycle) return;

    const totalMinutes = getTotalMinutesForUserInCycle(shift.userId, activeQuotaCycle.id);
    const quotaMinutes = getQuotaForUnit(shift.unitRole);
    const quotaMet = totalMinutes >= quotaMinutes;
    const cycleEnd = getNextQuotaCycleEnd();

    const embed = new EmbedBuilder()
      .setTitle('🔴 Shift Ended')
      .setColor('#FF0000')
      .setDescription(`**${shift.username}** has ended their shift`)
      .addFields(
        { name: 'Unit', value: shift.unitRole, inline: true },
        { name: 'Started At', value: formatTimestamp(shift.startTime), inline: true },
        { name: 'Ended At', value: formatTimestamp(shift.endTime!), inline: true },
        { name: 'Shift Duration', value: formatDuration(shift.durationMinutes!), inline: true },
        { name: 'Total Time This Cycle', value: `${formatDuration(totalMinutes)} / ${formatDuration(quotaMinutes)}`, inline: true },
        { name: 'Quota Status', value: quotaMet ? '✅ Met' : '❌ Not Met', inline: true },
        { name: 'Start Picture', value: `[View Image](${shift.startPictureLink})`, inline: true },
        { name: 'End Picture', value: `[View Image](${shift.endPictureLink})`, inline: true }
      )
      .setFooter({ text: `Activity cycle ends: ${formatDateForCycleEnd(cycleEnd)}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error logging shift end:', error);
  }
}

export async function logAuditAction(
  client: Client,
  adminUsername: string,
  action: string,
  details: string
): Promise<void> {
  const channelId = process.env.AUDIT_LOG_CHANNEL_ID;
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('📋 Audit Log')
      .setColor('#FFA500')
      .setDescription(`**${adminUsername}** performed: ${action}`)
      .addFields({ name: 'Details', value: details })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error logging audit action:', error);
  }
}
