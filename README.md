# Discord Activity Logger Bot

A Discord bot for tracking unit activity with shift logging, quota management, and comprehensive reporting features.

## Features

- **Shift Tracking**: Start and end shifts with picture proof submission
- **Activity Quotas**: Configurable quotas per unit with automatic tracking
- **Real-time Monitoring**: Auto-updating embed showing all active shifts
- **Detailed Logging**: All shift starts/ends logged with duration and cumulative time
- **Reports**: Generate unit-wide activity reports with quota status
- **Supervisor Tools**: Edit/delete shifts with audit logging
- **Quota Management**: Reset quotas per user, unit, or all at once
- **Permission System**: Configurable role-based permissions (Command, Supervisor)
- **Auto-end Shifts**: Optional auto-end for shifts exceeding maximum duration

## Commands

### User Commands
- `/start_shift [picture_link]` - Start your patrol shift
- `/end_shift [picture_link]` - End your patrol shift
- `/check_activity [user]` - Check activity logs (yours or another user's)

### Supervisor Commands
- `/activity_report [unit_role]` - Generate activity report for a unit
- `/edit_shift [shift_id] [new_minutes] [reason]` - Edit shift duration
- `/delete_shift [shift_id] [reason]` - Delete a shift record

### Command Staff Commands
- `/set_quota [unit_role] [minutes]` - Set activity quota for a unit (in-memory only)
- `/reset_quota [target]` - Reset quota data (unit name, @user, or "all")

## Installation

### Prerequisites
- Node.js v18 or higher
- npm or yarn
- A Discord Bot Application ([Create one here](https://discord.com/developers/applications))

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd kasloGilly
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Fill in your Discord bot credentials:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_server_id_here
   SHIFT_LOG_CHANNEL_ID=channel_id_for_shift_logs
   ACTIVE_SHIFTS_CHANNEL_ID=channel_id_for_active_shifts
   AUDIT_LOG_CHANNEL_ID=channel_id_for_audit_logs
   ```

4. **Configure bot settings**
   - Edit `config/config.json` to set up:
     - Permission roles (Command, Supervisor)
     - Unit roles with Discord role IDs
     - Quota requirements per unit
     - Quota cycle timing (default: Sunday 11:59 PM EST)
     - Auto-end shift settings

   Example configuration:
   ```json
   {
     "permissions": {
       "command": {
         "Chief": "DISCORD_ROLE_ID_HERE",
         "Deputy Chief": "DISCORD_ROLE_ID_HERE"
       },
       "supervisor": {
         "Supervisor": "DISCORD_ROLE_ID_HERE"
       }
     },
     "unitRoles": {
       "Patrol Unit": ["ROLE_ID_1", "ROLE_ID_2"],
       "SWAT": ["ROLE_ID_3"]
     },
     "quotas": {
       "defaultMinutes": 30,
       "unitQuotas": {
         "Patrol Unit": 120,
         "SWAT": 90
       }
     },
     "quotaCycle": {
       "dayOfWeek": 0,
       "hour": 23,
       "minute": 59,
       "second": 0,
       "timezone": "America/New_York"
     }
   }
   ```

5. **Build the bot**
   ```bash
   npm run build
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

## Discord Bot Setup

1. **Enable Required Intents**
   - Go to Discord Developer Portal
   - Navigate to your application → Bot
   - Enable these privileged intents:
     - Server Members Intent
     - Message Content Intent (if needed)

2. **Invite the Bot**
   - Use this URL format (replace CLIENT_ID):
   ```
   https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=274878024768&scope=bot%20applications.commands
   ```

3. **Create Required Channels**
   - Create three channels:
     - `#shift-logs` - For shift start/end logs
     - `#active-shifts` - For real-time active shifts display
     - `#audit-logs` - For administrative action logs
   - Copy their IDs into your `.env` file

## Configuration Guide

### Setting Up Roles

1. **Get Role IDs**
   - Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
   - Right-click roles → Copy ID

2. **Add to config.json**
   - Add Command roles under `permissions.command`
   - Add Supervisor roles under `permissions.supervisor`
   - Add Unit roles under `unitRoles` (can have multiple role IDs per unit)

### Quota Cycle Configuration

The quota cycle determines when activity quotas reset.

- `dayOfWeek`: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
- `hour`, `minute`, `second`: Time of day (24-hour format)
- `timezone`: IANA timezone string (e.g., "America/New_York")

Example: Reset every Sunday at 11:59 PM EST
```json
"quotaCycle": {
  "dayOfWeek": 0,
  "hour": 23,
  "minute": 59,
  "second": 0,
  "timezone": "America/New_York"
}
```

### Auto-End Shifts (Optional)

To enable automatic ending of long shifts:

1. Set `autoEndEnabled: true` in `config/config.json`
2. Adjust `autoEndAfterHours` (default: 10)
3. Uncomment the line in `src/events/ready.ts`:
   ```typescript
   startAutoEndShiftsMonitor(client);
   ```

## Database

The bot uses SQLite for data storage. The database file is created automatically at `database/activity.db`.

### Database Schema
- `quota_cycles` - Tracks activity cycle periods
- `shifts` - Records all shift data
- `audit_logs` - Logs administrative actions

Data is retained until manually reset using `/reset_quota`.

## Project Structure

```
discord-activity-bot/
├── src/
│   ├── commands/         # Slash command handlers
│   ├── events/           # Discord event handlers
│   ├── services/         # Business logic services
│   ├── utils/            # Helper functions
│   ├── database/         # Database operations
│   ├── types/            # TypeScript type definitions
│   ├── config.ts         # Configuration loader
│   └── index.ts          # Entry point
├── config/
│   └── config.json       # Bot configuration
├── database/             # SQLite database (auto-created)
├── .env                  # Environment variables
├── package.json
└── tsconfig.json
```

## Troubleshooting

### Bot doesn't respond to commands
- Verify bot has proper permissions in the server
- Check that slash commands are registered (should happen automatically on bot startup)
- Ensure `GUILD_ID` and `CLIENT_ID` are correct in `.env`

### Permission errors
- Verify role IDs in `config/config.json` are correct
- Check that users have the appropriate roles assigned
- Command permissions: Only Command roles can use admin commands
- Supervisor permissions: Supervisors + Command roles can edit/delete shifts

### Active shifts embed not updating
- Verify `ACTIVE_SHIFTS_CHANNEL_ID` is set correctly
- Check bot has permission to send messages in that channel
- Ensure bot is online and ready

### Database errors
- Delete `database/activity.db` to reset (WARNING: deletes all data)
- Check file permissions on the database directory

## License

MIT

## Support

For issues, questions, or feature requests, please open an issue on GitHub
