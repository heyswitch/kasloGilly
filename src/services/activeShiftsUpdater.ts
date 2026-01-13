import { Client, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { getAllActiveShifts } from '../database/database';
import { getCurrentShiftDuration, formatDuration } from '../utils/timeFormatter';

let updateInterval: NodeJS.Timeout | null = null;
let activeShiftsMessage: Message | null = null;

export function startActiveShiftsUpdater(client: Client): void {
  const channelId = process.env.ACTIVE_SHIFTS_CHANNEL_ID;

  if (!channelId) {
    console.warn('⚠️  ACTIVE_SHIFTS_CHANNEL_ID not set, active shifts updater disabled');
    return;
  }

  console.log('🔄 Starting active shifts updater...');

  // Update every 30 seconds
  updateInterval = setInterval(async () => {
    try {
      const channel = await client.channels.fetch(channelId) as TextChannel;
      if (!channel) return;

      const embed = await createActiveShiftsEmbed();

      // If message doesn't exist or was deleted, create a new one
      if (!activeShiftsMessage) {
        try {
          // Try to find existing message in last 10 messages
          const messages = await channel.messages.fetch({ limit: 10 });
          activeShiftsMessage = messages.find(m => m.author.id === client.user?.id && m.embeds.length > 0) || null;
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      }

      if (activeShiftsMessage) {
        try {
          await activeShiftsMessage.edit({ embeds: [embed] });
        } catch (error) {
          // Message was deleted, create new one
          activeShiftsMessage = await channel.send({ embeds: [embed] });
        }
      } else {
        activeShiftsMessage = await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error updating active shifts:', error);
    }
  }, 30000); // 30 seconds

  // Initial update
  setTimeout(async () => {
    try {
      const channel = await client.channels.fetch(channelId) as TextChannel;
      if (!channel) return;

      const embed = await createActiveShiftsEmbed();
      activeShiftsMessage = await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error creating initial active shifts message:', error);
    }
  }, 2000);
}

async function createActiveShiftsEmbed(): Promise<EmbedBuilder> {
  const activeShifts = getAllActiveShifts();

  const embed = new EmbedBuilder()
    .setTitle('🚨 Active Shifts')
    .setColor('#00FF00')
    .setTimestamp();

  if (activeShifts.length === 0) {
    embed.setDescription('*No active shifts at this time.*');
    embed.setColor('#FF0000');
  } else {
    const shiftLines = activeShifts.map(shift => {
      const duration = getCurrentShiftDuration(shift.startTime);
      return `**${shift.username}** (${shift.unitRole})\n└ On duty for: ${formatDuration(duration)}`;
    });

    embed.setDescription(shiftLines.join('\n\n'));
    embed.setFooter({ text: `${activeShifts.length} officer${activeShifts.length !== 1 ? 's' : ''} on duty` });
  }

  return embed;
}

export function stopActiveShiftsUpdater(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    console.log('🛑 Stopped active shifts updater');
  }
}
