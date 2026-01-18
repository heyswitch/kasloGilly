import { Client } from 'discord.js';
import { getAllActiveShifts, endShift } from '../database/database';
import { logShiftEnd } from './shiftLogger';
import { getAllGuildIds, getServerConfig } from '../config';

let autoEndInterval: NodeJS.Timeout | null = null;

/**
 * Automatically ends shifts that have been active for longer than the configured duration
 * NOTE: This feature is currently DISABLED by default in config.json (autoEndEnabled: false)
 *
 * To enable this feature:
 * 1. Set "autoEndEnabled": true in config/{GUILD_ID}.json
 * 2. Adjust "autoEndAfterHours" to your desired threshold (default: 10 hours)
 */
export function startAutoEndShiftsMonitor(client: Client): void {
  const guildIds = getAllGuildIds();

  if (guildIds.length === 0) {
    console.warn('⚠️  No guilds configured, auto-end shifts monitor disabled');
    return;
  }

  // Check if any guild has auto-end enabled
  const enabledGuilds = guildIds.filter(guildId => {
    const config = getServerConfig(guildId);
    return config.shifts.autoEndEnabled;
  });

  if (enabledGuilds.length === 0) {
    console.log('⏸️  Auto-end shifts is DISABLED for all guilds (set autoEndEnabled: true in config files to enable)');
    return;
  }

  console.log(`🕐 Starting auto-end shifts monitor for ${enabledGuilds.length} guild(s)...`);

  // Check every 5 minutes
  autoEndInterval = setInterval(async () => {
    for (const guildId of enabledGuilds) {
      try {
        const config = getServerConfig(guildId);
        const activeShifts = getAllActiveShifts(guildId);
        const now = Date.now();
        const maxDurationMs = config.shifts.autoEndAfterHours * 60 * 60 * 1000;

        for (const shift of activeShifts) {
          const shiftDurationMs = now - shift.startTime;

          // If shift has been active for longer than threshold
          if (shiftDurationMs >= maxDurationMs) {
            console.log(`⏱️  Auto-ending shift for ${shift.username} (${shift.unitRole}) in guild ${guildId} - exceeded ${config.shifts.autoEndAfterHours} hours`);

            // End shift with a system-generated note
            const endedShift = endShift(guildId, shift.id, 'AUTO-ENDED: Shift exceeded maximum duration');

            if (endedShift) {
              await logShiftEnd(client, guildId, endedShift);
            }
          }
        }
      } catch (error) {
        console.error(`Error in auto-end shifts monitor for guild ${guildId}:`, error);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}

export function stopAutoEndShiftsMonitor(): void {
  if (autoEndInterval) {
    clearInterval(autoEndInterval);
    autoEndInterval = null;
    console.log('🛑 Stopped auto-end shifts monitor');
  }
}

/*
 * IMPLEMENTATION NOTES:
 *
 * This feature is currently commented out/disabled in the main bot code.
 *
 * To activate it:
 * 1. Update config/config.json:
 *    - Set "autoEndEnabled": true
 *    - Adjust "autoEndAfterHours" if needed (default: 10)
 *
 * 2. Uncomment the following line in src/events/ready.ts:
 *    // startAutoEndShiftsMonitor(client);
 *
 * This will automatically end shifts that exceed the configured duration.
 * The ended shifts will be logged with "AUTO-ENDED" as the picture link.
 */
