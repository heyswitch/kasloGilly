import { Client } from 'discord.js';
import { getExpiredLOAs, removeDepartmentLeave } from '../database/database';
import { logLeaveRemoval } from './departmentLogger';
import { getAllGuildIds } from '../config';

let expiryInterval: NodeJS.Timeout | null = null;

export function startLOAExpiryMonitor(client: Client): void {
  const guildIds = getAllGuildIds();

  if (guildIds.length === 0) {
    console.warn('No guilds configured, LOA expiry monitor disabled');
    return;
  }

  console.log('Starting LOA expiry monitor...');

  // Run once immediately on startup, then every 24 hours
  const checkExpiredLOAs = async () => {
    for (const guildId of guildIds) {
      try {
        const expiredLOAs = getExpiredLOAs(guildId);

        for (const loa of expiredLOAs) {
          // Remove the LOA (auto-expired, so no user info)
          removeDepartmentLeave(guildId, loa.id, null, null);

          // Update the action with removal info for logging
          loa.removedAt = Date.now();
          await logLeaveRemoval(client, guildId, loa, true);

          console.log(`Auto-expired LOA for ${loa.targetUsername} in guild ${guildId}`);
        }
      } catch (error) {
        console.error(`Error in LOA expiry monitor for guild ${guildId}:`, error);
      }
    }
  };

  // Check immediately on startup
  checkExpiredLOAs();

  // Then check every 24 hours
  expiryInterval = setInterval(checkExpiredLOAs, 24 * 60 * 60 * 1000); // 24 hours
}

export function stopLOAExpiryMonitor(): void {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
    console.log('Stopped LOA expiry monitor');
  }
}
