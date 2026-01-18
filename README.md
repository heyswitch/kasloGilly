# Discord Activity Logger Bot - Multi-Server Edition

A powerful Discord bot for tracking unit activity with shift logging, quota management, and comprehensive reporting. **Supports unlimited Discord servers with complete data isolation.**

## 🎯 Key Features

- **Multi-Server Support** - Run one bot across unlimited Discord servers
- **Complete Data Isolation** - Each server has its own database and configuration
- **Shift Tracking** - Start/end shifts with picture proof and automatic duration calculation
- **Cryptographically Secure Shift Codes** - Random 8-character codes for each shift
- **Activity Quotas** - Configurable quotas per unit with automatic tracking
- **Real-time Monitoring** - Auto-updating embed showing all active shifts
- **Comprehensive Reports** - Unit-wide activity reports with quota status
- **Supervisor Tools** - Edit/delete shifts with audit logging
- **Permission System** - Three-tier role-based permissions (Command, Supervisor, Employee)
- **Flexible Quota Cycles** - Configurable reset schedules per server

## 📖 Documentation

**[Complete Setup Guide →](SETUP_GUIDE.md)** - Comprehensive guide for adding new departments/servers

**[Multi-Server Implementation Details →](MULTI_SERVER_IMPLEMENTATION_COMPLETE.md)** - Technical implementation details

**[Shift Codes Information →](SHIFT_CODES_README.md)** - How shift codes work

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Discord Bot Token ([Create one here](https://discord.com/developers/applications))

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DISCORD_TOKEN and CLIENT_ID

# 3. Configure your first server
# Copy config/TEMPLATE.json to config/YOUR_GUILD_ID.json
# Fill in role IDs and channel IDs

# 4. Build and start
npm run build
npm start
```

**For detailed setup instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md)**

## 📋 Commands

### Employee Commands (Basic Access)
- `/start_shift [picture_link]` - Start your shift
- `/end_shift [picture_link]` - End your shift
- `/check_activity [user]` - Check your activity (shows shift codes)

### Supervisor Commands
- `/activity_report [unit_role]` - Generate unit activity report
- `/edit_shift [shift_code] [new_minutes] [reason]` - Edit shift duration
- `/delete_shift [shift_code] [reason]` - Delete a shift record

### Command Staff
- `/set_quota [unit_role] [minutes]` - Set activity quota for a unit
- `/reset_quota [target]` - Reset quota data (unit name, @user, or "all")

## 🏢 Multi-Server Architecture

### One Bot, Multiple Departments

```
Your Bot Instance
├── config/
│   ├── 1398027559194853406.json  ← Kaslo PD
│   ├── 9876543210123456789.json  ← LSPD
│   └── TEMPLATE.json              ← Template for new servers
│
└── databases/
    ├── 1398027559194853406.db     ← Kaslo PD data
    └── 9876543210123456789.db     ← LSPD data (isolated)
```

### Benefits
- ✅ Complete data isolation per server
- ✅ Server-specific configurations
- ✅ Independent permissions
- ✅ Easy to add new servers
- ✅ Scalable to unlimited departments

## 🔧 Configuration

Each server needs:
1. **Config File** - `config/{GUILD_ID}.json`
2. **Role IDs** - Discord role IDs for permissions
3. **Channel IDs** - Three channels for logging
4. **Quotas** - Time requirements per unit
5. **Quota Cycle** - When quotas reset

**Example minimal config:**
```json
{
  "name": "Your Department Name",
  "permissions": {
    "command": { "Chief": "ROLE_ID" },
    "supervisor": { "Supervisor": "ROLE_ID" },
    "employee": { "Department Member": "ROLE_ID" }
  },
  "unitRoles": {
    "Patrol Unit": ["ROLE_ID_1", "ROLE_ID_2"]
  },
  "quotas": {
    "defaultMinutes": 30,
    "unitQuotas": {
      "Patrol Unit": 120
    }
  },
  "quotaCycle": {
    "dayOfWeek": 0,
    "hour": 23,
    "minute": 59,
    "second": 0,
    "timezone": "America/New_York"
  },
  "shifts": {
    "autoEndAfterHours": 10,
    "autoEndEnabled": false
  },
  "channels": {
    "shiftLog": "CHANNEL_ID",
    "activeShifts": "CHANNEL_ID",
    "auditLog": "CHANNEL_ID"
  }
}
```

**See [SETUP_GUIDE.md](SETUP_GUIDE.md) for complete configuration reference.**

## 📁 Project Structure

```
kasloGilly/
├── src/
│   ├── commands/         # Slash command handlers
│   ├── services/         # Business logic services
│   ├── database/         # Multi-server database manager
│   ├── types/            # TypeScript type definitions
│   ├── config.ts         # Multi-server config loader
│   └── index.ts          # Entry point
├── config/
│   ├── {GUILD_ID}.json   # Per-server configurations
│   └── TEMPLATE.json     # Template for new servers
├── databases/
│   └── {GUILD_ID}.db     # Per-server databases
├── .env                  # Bot token & client ID
└── package.json
```

## 🆕 Adding a New Server/Department

**Quick Steps:**

1. **Get Guild ID** - Right-click server → Copy Server ID
2. **Create Config** - `cp config/TEMPLATE.json config/{GUILD_ID}.json`
3. **Fill in Config** - Add role IDs, channel IDs, quotas
4. **Restart Bot** - Bot auto-detects new config

**Detailed walkthrough in [SETUP_GUIDE.md](SETUP_GUIDE.md)**

## 🔐 Permission System

### Three-Tier Hierarchy

**Command Level (Highest)**
- Full access to all commands
- Can set/reset quotas
- Can use all supervisor/employee commands
- Typically: Chiefs, Deputy Chiefs

**Supervisor Level (Middle)**
- Can view all activity reports
- Can edit/delete shifts
- Can use all employee commands
- Typically: Supervisors, Shift Commanders

**Employee Level (Basic)**
- Can start/end own shifts
- Can check own activity
- Cannot see other users' data
- Typically: All department members

## 🗄️ Database

- **Engine:** SQLite (one database per server)
- **Location:** `databases/{GUILD_ID}.db`
- **Schema:** Quota cycles, shifts, audit logs
- **Isolation:** Complete separation between servers

### Tables
- `quota_cycles` - Activity cycle periods
- `shifts` - All shift records with secure codes
- `audit_logs` - Administrative actions

## 🛠️ Development

```bash
# Development with auto-reload
npm run dev

# Watch mode (auto-compile TypeScript)
npm run watch

# Build production
npm run build

# Start production
npm start
```

## 🐛 Troubleshooting

### Bot Won't Start
- Check `.env` has valid `DISCORD_TOKEN` and `CLIENT_ID`
- Verify at least one config file exists in `config/`
- Check JSON syntax in config files

### Commands Not Showing
- Wait 1-2 minutes for Discord to sync
- Refresh Discord (Ctrl+R / Cmd+R)
- Check bot has `applications.commands` scope

### Permission Errors
- Verify role IDs in config match your Discord server
- Check user has the correct role assigned
- Remember: Role IDs are different in each Discord server

### Data Issues
- Each server has its own database in `databases/`
- Check you're looking at the right guild's data
- Verify quota cycle exists (bot creates automatically)

**For more troubleshooting, see [SETUP_GUIDE.md](SETUP_GUIDE.md#troubleshooting)**

## 📊 Features in Detail

### Shift Codes
- 8-character cryptographically secure random codes
- Example: `JE6RGXLT`, `ABC12345`
- ~2.8 trillion possible combinations
- Used for editing/deleting shifts
- See [SHIFT_CODES_README.md](SHIFT_CODES_README.md)

### Activity Reports
- Shows all users in a unit (even with 0 shifts)
- Progress bars and quota status
- Sorted by time logged
- Includes users who haven't started shifts

### Quota Cycles
- Flexible scheduling (any day/time)
- Timezone aware
- Auto-resets on schedule
- Different cycles per server

## 🔄 Backup & Migration

**Backup a Server:**
```bash
cp databases/GUILD_ID.db backups/
cp config/GUILD_ID.json backups/
```

**Migrate to New Server:**
1. Copy config to new guild ID
2. Update all role IDs and channel IDs
3. Optionally copy database to keep history
4. Restart bot

## 🎯 Use Cases

### Single Department
- One Discord server
- One config file
- One database

### Multiple Departments
- Multiple Discord servers
- Multiple config files
- Multiple databases (isolated)

### Large Organizations
- Headquarters server + regional servers
- Central bot instance
- Complete data separation per region

## 📝 Environment Variables

```env
# Required
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id

# Optional (not used in multi-server mode)
# GUILD_ID - Deprecated, now in config files
# CHANNEL_IDs - Deprecated, now in config files
```

## 🔗 Links

- **Setup Guide:** [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **Implementation Details:** [MULTI_SERVER_IMPLEMENTATION_COMPLETE.md](MULTI_SERVER_IMPLEMENTATION_COMPLETE.md)
- **Shift Codes:** [SHIFT_CODES_README.md](SHIFT_CODES_README.md)
- **Discord Developer Portal:** https://discord.com/developers/applications

## 📜 License

MIT License - Use freely for your department!

## 💡 Tips

- Use descriptive unit names in your config
- Set realistic quotas for your department
- Create separate channels for logs to keep things organized
- Use shift codes for editing (easier than numeric IDs)
- Back up your databases regularly
- Test in a test server before deploying to production

## 🆘 Support

**Common Issues:**
- [Setup Guide - Troubleshooting](SETUP_GUIDE.md#troubleshooting)
- Check console logs for errors
- Verify configuration syntax
- Ensure bot has proper Discord permissions

**Getting Help:**
1. Review the [Setup Guide](SETUP_GUIDE.md)
2. Check console output
3. Verify all IDs are correct
4. Test with minimal config first

---

**Version:** Multi-Server 2.0
**Last Updated:** January 13, 2026
**Status:** Production Ready ✅
