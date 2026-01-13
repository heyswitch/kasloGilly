import { Client } from 'discord.js';
import { getAllActiveShifts, endShift } from '../database/database';
import { logShiftEnd } from './shiftLogger';
import { getConfig } from '../config';

let autoEndInterval: NodeJS.Timeout | null = null;

/**
 * Automatically ends shifts that have been active for longer than the configured duration
 * NOTE: This feature is currently DISABLED by default in config.json (autoEndEnabled: false)
 *
 * To enable this feature:
 * 1. Set "autoEndEnabled": true in config/config.json
 * 2. Adjust "autoEndAfterHours" to your desired threshold (default: 10 hours)
 */
export function startAutoEndShiftsMonitor(client: Client): void {
  const config = getConfig();

  // Check if auto-end is enabled in config
  if (!config.shifts.autoEndEnabled) {
    console.log('⏸️  Auto-end shifts is DISABLED (set autoEndEnabled: true in config.json to enable)');
    return;
  }

  console.log(`🕐 Starting auto-end shifts monitor (threshold: ${config.shifts.autoEndAfterHours} hours)...`);

  // Check every 5 minutes
  autoEndInterval = setInterval(async () => {
    try {
      const activeShifts = getAllActiveShifts();
      const now = Date.now();
      const maxDurationMs = config.shifts.autoEndAfterHours * 60 * 60 * 1000;

      for (const shift of activeShifts) {
        const shiftDurationMs = now - shift.startTime;

        // If shift has been active for longer than threshold
        if (shiftDurationMs >= maxDurationMs) {
          console.log(`⏱️  Auto-ending shift for ${shift.username} (${shift.unitRole}) - exceeded ${config.shifts.autoEndAfterHours} hours`);

          // End shift with a system-generated note
          const endedShift = endShift(shift.id, 'AUTO-ENDED: Shift exceeded maximum duration');

          if (endedShift) {
            await logShiftEnd(client, endedShift);
          }
        }
      }
    } catch (error) {
      console.error('Error in auto-end shifts monitor:', error);
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
