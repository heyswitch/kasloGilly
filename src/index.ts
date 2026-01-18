import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { config as dotenvConfig } from 'dotenv';
import { loadAllConfigs, getAllGuildIds } from './config';
import { initAllDatabases, getActiveQuotaCycle, createQuotaCycle } from './database/database';
import { readdirSync } from 'fs';
import { join } from 'path';

dotenvConfig();

// Load ALL server configurations
loadAllConfigs();

// Get list of configured guilds
const guildIds = getAllGuildIds();

// Initialize databases for all configured servers
initAllDatabases(guildIds);

// Ensure each server has an active quota cycle
for (const guildId of guildIds) {
  let activeQuotaCycle = getActiveQuotaCycle(guildId);
  if (!activeQuotaCycle) {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    activeQuotaCycle = createQuotaCycle(guildId, now, now + oneWeek);
    console.log(`✅ Created initial quota cycle for guild ${guildId}`);
  }
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// Command collection
const commands = new Collection<string, any>();

// Load commands
const commandFiles = readdirSync(join(__dirname, 'commands')).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (command.data && command.execute) {
    commands.set(command.data.name, command);
  }
}

client.commands = commands;

// Load events
const eventFiles = readdirSync(join(__dirname, 'events')).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

for (const file of eventFiles) {
  const event = require(`./events/${file}`);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Handle interactions
client.on('interactionCreate', async interaction => {
  // Handle autocomplete
  if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error('Error handling autocomplete:', error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Error executing command:', error);
    const errorMessage = 'There was an error executing this command!';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Register commands for all configured guilds
async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands for all guilds.');

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    const commandData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

    // Register commands for each configured guild
    for (const guildId of guildIds) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId),
          { body: commandData },
        );
        console.log(`✅ Successfully registered commands for guild ${guildId}`);
      } catch (error) {
        console.error(`❌ Failed to register commands for guild ${guildId}:`, error);
      }
    }

    console.log('✅ Successfully reloaded application (/) commands for all guilds.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Login
client.login(process.env.DISCORD_TOKEN);

// Register commands when ready
client.once('ready', () => {
  registerCommands();
});

// Extend the Client type
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, any>;
  }
}
