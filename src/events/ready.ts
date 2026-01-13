import { Client } from 'discord.js';
import { startActiveShiftsUpdater } from '../services/activeShiftsUpdater';
// import { startAutoEndShiftsMonitor } from '../services/autoEndShifts';

module.exports = {
  name: 'ready',
  once: true,
  execute(client: Client) {
    console.log(`✅ Logged in as ${client.user?.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guild(s)`);

    // Start the active shifts updater
    startActiveShiftsUpdater(client);

    // Auto-end shifts after configured hours (DISABLED by default)
    // To enable: Set "autoEndEnabled": true in config/config.json
    // Then uncomment the line below:
    // startAutoEndShiftsMonitor(client);
  },
};
