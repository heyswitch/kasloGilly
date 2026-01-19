import { Client, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { getAllActiveShifts } from '../database/database';
import { getCurrentShiftDuration, formatDuration } from '../utils/timeFormatter';
import { getAllGuildIds, getServerConfig } from '../config';

let updateInterval: NodeJS.Timeout | null = null;
// Store messages per guild
const activeShiftsMessages: Map<string, Message> = new Map();

export function startActiveShiftsUpdater(client: Client): void {
  const guildIds = getAllGuildIds();

  if (guildIds.length === 0) {
    console.warn('⚠️  No guilds configured, active shifts updater disabled');
    return;
  }

  console.log('🔄 Starting active shifts updater...');

  // Update every 30 seconds
  updateInterval = setInterval(async () => {
    for (const guildId of guildIds) {
      try {
        const config = getServerConfig(guildId);
        const channelId = config.channels.activeShifts;

        if (!channelId) continue;

        const channel = await client.channels.fetch(channelId) as TextChannel;
        if (!channel) continue;

        const embed = await createActiveShiftsEmbed(guildId);

        // Get or find the message for this guild
        let activeShiftsMessage = activeShiftsMessages.get(guildId);

        // If message doesn't exist or was deleted, try to find it
        if (!activeShiftsMessage) {
          try {
            const messages = await channel.messages.fetch({ limit: 10 });
            activeShiftsMessage = messages.find(m => m.author.id === client.user?.id && m.embeds.length > 0) || undefined;
            if (activeShiftsMessage) {
              activeShiftsMessages.set(guildId, activeShiftsMessage);
            }
          } catch (error) {
            console.error(`Error fetching messages for guild ${guildId}:`, error);
          }
        }

        if (activeShiftsMessage) {
          try {
            await activeShiftsMessage.edit({ embeds: [embed] });
          } catch (error) {
            // Message was deleted, create new one
            const newMessage = await channel.send({ embeds: [embed] });
            activeShiftsMessages.set(guildId, newMessage);
          }
        } else {
          const newMessage = await channel.send({ embeds: [embed] });
          activeShiftsMessages.set(guildId, newMessage);
        }
      } catch (error) {
        console.error(`Error updating active shifts for guild ${guildId}:`, error);
      }
    }
  }, 60000); // 60 seconds

  // Initial update
  setTimeout(async () => {
    for (const guildId of guildIds) {
      try {
        const config = getServerConfig(guildId);
        const channelId = config.channels.activeShifts;

        if (!channelId) continue;

        const channel = await client.channels.fetch(channelId) as TextChannel;
        if (!channel) continue;

        const embed = await createActiveShiftsEmbed(guildId);
        const message = await channel.send({ embeds: [embed] });
        activeShiftsMessages.set(guildId, message);
      } catch (error) {
        console.error(`Error creating initial active shifts message for guild ${guildId}:`, error);
      }
    }
  }, 2000);
}

async function createActiveShiftsEmbed(guildId: string): Promise<EmbedBuilder> {
  const activeShifts = getAllActiveShifts(guildId);

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
