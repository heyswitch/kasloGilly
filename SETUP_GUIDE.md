# Multi-Server Discord Activity Bot - Setup Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Understanding the Architecture](#understanding-the-architecture)
3. [Adding a New Department/Server](#adding-a-new-departmentserver)
4. [Configuration Reference](#configuration-reference)
5. [Troubleshooting](#troubleshooting)
6. [Advanced Topics](#advanced-topics)

---

## Quick Start

### Prerequisites
- Node.js 20+ installed
- A Discord Bot created in [Discord Developer Portal](https://discord.com/developers/applications)
- Bot Token and Client ID

### Initial Setup

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Create/update `.env` file:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   ```

3. **Your First Server is Already Configured!**
   - Config: `config/1398027559194853406.json` (Kaslo PD)
   - Database: `databases/1398027559194853406.db`

4. **Start the Bot**
   ```bash
   npm run build
   npm start
   ```

---

## Understanding the Architecture

### Multi-Server Design

This bot supports **unlimited Discord servers** with **complete data isolation**.

```
Your Bot
├── config/
│   ├── {GUILD_ID_1}.json    ← Server 1 configuration
│   ├── {GUILD_ID_2}.json    ← Server 2 configuration
│   └── TEMPLATE.json        ← Template for new servers
│
└── databases/
    ├── {GUILD_ID_1}.db      ← Server 1 data (shifts, quotas, etc.)
    └── {GUILD_ID_2}.db      ← Server 2 data (completely isolated)
```

### Key Concepts

**Guild ID (Server ID)**
- Unique identifier for each Discord server
- Used as the filename for configs and databases
- Example: `1398027559194853406`

**Complete Data Isolation**
- Each server has its own database file
- Each server has its own configuration
- No data sharing between servers
- No permission leakage

**Configuration Files**
- JSON files named `{GUILD_ID}.json`
- Contains roles, quotas, channels, etc.
- Server-specific settings

---

## Adding a New Department/Server

### Step 1: Get Your Discord Server's Guild ID

1. **Enable Developer Mode in Discord**
   - Open Discord
   - Go to User Settings (gear icon)
   - Click "Advanced" in the left sidebar
   - Enable "Developer Mode"

2. **Copy Your Server's Guild ID**
   - Right-click on your server icon (in the left sidebar)
   - Click "Copy Server ID"
   - Save this ID - you'll need it!

   Example: `9876543210123456789`

### Step 2: Create Configuration File

1. **Copy the Template**
   ```bash
   cp config/TEMPLATE.json config/9876543210123456789.json
   ```

   Replace `9876543210123456789` with your actual Guild ID!

2. **The template will look like this:**
   ```json
   {
     "name": "Your Department Name",
     "permissions": {
       "command": {
         "Chief": "ROLE_ID_HERE",
         "Deputy Chief": "ROLE_ID_HERE",
         "Assistant Chief": "ROLE_ID_HERE"
       },
       "supervisor": {
         "Supervisor": "ROLE_ID_HERE",
         "Senior Supervisor": "ROLE_ID_HERE",
         "Shift Commander": "ROLE_ID_HERE"
       },
       "employee": {
         "Department Member": "ROLE_ID_HERE"
       }
     },
     "unitRoles": {
       "Patrol Unit": ["ROLE_ID_1", "ROLE_ID_2"],
       "Training Unit": ["ROLE_ID_3"],
       "SWAT": ["ROLE_ID_4"],
       "Traffic Unit": ["ROLE_ID_5"]
     },
     "quotas": {
       "defaultMinutes": 30,
       "unitQuotas": {
         "Patrol Unit": 120,
         "Training Unit": 60,
         "SWAT": 90,
         "Traffic Unit": 120
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
     "notifications": {
       "quotaWarningPercentage": 75,
       "quotaReminderPercentage": 50
     },
     "channels": {
       "shiftLog": "CHANNEL_ID_HERE",
       "activeShifts": "CHANNEL_ID_HERE",
       "auditLog": "CHANNEL_ID_HERE"
     }
   }
   ```

### Step 3: Get Discord Role IDs

You need to get Role IDs from your Discord server.

1. **Enable Developer Mode** (if not already done)

2. **Get Role IDs**
   - Go to Server Settings → Roles
   - Right-click on a role
   - Click "Copy Role ID"
   - Paste it into your config file

3. **Update Each Role in the Config**

   **Example - Command Permissions (Chiefs):**
   ```json
   "command": {
     "Chief": "1234567890123456789",
     "Deputy Chief": "1234567890123456780",
     "Assistant Chief": "1234567890123456781"
   }
   ```

   **Example - Supervisor Permissions:**
   ```json
   "supervisor": {
     "Supervisor": "1234567890123456782",
     "Senior Supervisor": "1234567890123456783",
     "Shift Commander": "1234567890123456784"
   }
   ```

   **Example - Employee Permissions:**
   ```json
   "employee": {
     "Department Member": "1234567890123456785"
   }
   ```

   **Example - Unit Roles:**
   ```json
   "unitRoles": {
     "Patrol Unit": ["1234567890123456786", "1234567890123456787"],
     "Training Unit": ["1234567890123456788"],
     "SWAT": ["1234567890123456789"],
     "Traffic Unit": ["1234567890123456790"]
   }
   ```

### Step 4: Get Discord Channel IDs

You need three channel IDs:

1. **Shift Log Channel** - Where shift start/end messages are posted
2. **Active Shifts Channel** - Where the live active shifts embed updates
3. **Audit Log Channel** - Where admin actions are logged

**How to Get Channel IDs:**
1. Enable Developer Mode (if not already)
2. Right-click on a channel
3. Click "Copy Channel ID"
4. Paste into your config

**Example:**
```json
"channels": {
  "shiftLog": "1460713097944895707",
  "activeShifts": "1460713123714564248",
  "auditLog": "1460713173446561967"
}
```

### Step 5: Customize Your Configuration

**1. Update Department Name**
```json
"name": "Los Santos Police Department"
```

**2. Adjust Quotas (in minutes)**
```json
"quotas": {
  "defaultMinutes": 30,
  "unitQuotas": {
    "Patrol Unit": 120,      // 2 hours
    "Training Unit": 60,     // 1 hour
    "SWAT": 90,              // 1.5 hours
    "Traffic Unit": 120      // 2 hours
  }
}
```

**3. Set Quota Cycle (when quotas reset)**
```json
"quotaCycle": {
  "dayOfWeek": 0,      // 0=Sunday, 1=Monday, ..., 6=Saturday
  "hour": 23,          // Hour (0-23, 24-hour format)
  "minute": 59,        // Minute (0-59)
  "second": 0,         // Second (0-59)
  "timezone": "America/New_York"
}
```

**Common Timezones:**
- `America/New_York` - Eastern Time
- `America/Chicago` - Central Time
- `America/Denver` - Mountain Time
- `America/Los_Angeles` - Pacific Time
- `America/Phoenix` - Arizona (no DST)
- `Europe/London` - UK Time

**4. Configure Auto-End Shifts (Optional)**
```json
"shifts": {
  "autoEndAfterHours": 10,
  "autoEndEnabled": false    // Set to true to enable
}
```

### Step 6: Add Your Unit Roles

You can customize the units/divisions in your department:

```json
"unitRoles": {
  "Patrol Division": ["ROLE_ID_1", "ROLE_ID_2"],
  "Detective Bureau": ["ROLE_ID_3"],
  "K9 Unit": ["ROLE_ID_4"],
  "Traffic Division": ["ROLE_ID_5"],
  "Special Operations": ["ROLE_ID_6"]
}
```

Each unit can have multiple role IDs. Users with ANY of those roles will be considered part of that unit.

### Step 7: Verify Your Configuration

**Check Your Config File**
```bash
cat config/YOUR_GUILD_ID.json | grep "ROLE_ID_HERE"
cat config/YOUR_GUILD_ID.json | grep "CHANNEL_ID_HERE"
```

If you see any `ROLE_ID_HERE` or `CHANNEL_ID_HERE`, you haven't finished configuring!

**Validate JSON Syntax**
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('config/YOUR_GUILD_ID.json')))"
```

If this command succeeds without errors, your JSON is valid.

### Step 8: Restart the Bot

```bash
npm start
```

You should see:
```
✅ Loaded config for guild 1398027559194853406 (Kaslo Police Department)
✅ Loaded config for guild 9876543210123456789 (Your Department Name)
✅ Loaded 2 server configuration(s)
✅ Database initialized for guild 1398027559194853406
✅ Database initialized for guild 9876543210123456789
✅ Successfully registered commands for guild 1398027559194853406
✅ Successfully registered commands for guild 9876543210123456789
```

### Step 9: Test in Discord

1. **Go to your new Discord server**
2. **Try commands:**
   - `/start_shift` - Start a shift
   - `/check_activity` - Check your activity
   - `/activity_report unit_role:Patrol Unit` - View unit report
   - `/end_shift` - End your shift

**If commands don't appear:**
- Wait 1-2 minutes for Discord to sync
- Refresh Discord (Ctrl+R or Cmd+R)
- Check bot has proper permissions in the server

---

## Configuration Reference

### Complete Configuration Breakdown

#### 1. Department Name
```json
"name": "Your Department Name"
```
- Displayed in logs and console
- Used for identification

#### 2. Permission Levels

The bot has three permission tiers:

**Command Level (Highest)**
- Can use ALL commands
- Includes supervisor and employee commands
- Typically: Chiefs, Deputy Chiefs

```json
"command": {
  "Chief": "ROLE_ID",
  "Deputy Chief": "ROLE_ID"
}
```

**Supervisor Level (Middle)**
- Can use supervisor commands
- Includes employee commands
- Can view all activity reports
- Can edit/delete shifts
- Typically: Supervisors, Shift Commanders

```json
"supervisor": {
  "Supervisor": "ROLE_ID",
  "Shift Commander": "ROLE_ID"
}
```

**Employee Level (Basic)**
- Can start/end shifts
- Can check their own activity
- Cannot see other users' activity (unless supervisor)

```json
"employee": {
  "Department Member": "ROLE_ID"
}
```

#### 3. Unit Roles

Define your department's units/divisions:

```json
"unitRoles": {
  "Unit Name": ["ROLE_ID_1", "ROLE_ID_2"],
  "Another Unit": ["ROLE_ID_3"]
}
```

**Key Points:**
- Unit names can be anything you want
- Each unit can have multiple role IDs
- Users can be in multiple units
- Used for activity reports and quotas

#### 4. Quotas

Set time requirements for each unit:

```json
"quotas": {
  "defaultMinutes": 30,
  "unitQuotas": {
    "Patrol Unit": 120,
    "Training Unit": 60
  }
}
```

**Values are in MINUTES:**
- `30` = 30 minutes
- `60` = 1 hour
- `120` = 2 hours
- `180` = 3 hours

**defaultMinutes:**
- Used if a unit doesn't have a specific quota

#### 5. Quota Cycle

When quotas reset:

```json
"quotaCycle": {
  "dayOfWeek": 0,
  "hour": 23,
  "minute": 59,
  "second": 0,
  "timezone": "America/New_York"
}
```

**dayOfWeek:**
- `0` = Sunday
- `1` = Monday
- `2` = Tuesday
- `3` = Wednesday
- `4` = Thursday
- `5` = Friday
- `6` = Saturday

**Example: Reset every Sunday at 11:59 PM EST**
```json
{
  "dayOfWeek": 0,
  "hour": 23,
  "minute": 59,
  "second": 0,
  "timezone": "America/New_York"
}
```

**Example: Reset every Friday at 6:00 PM PST**
```json
{
  "dayOfWeek": 5,
  "hour": 18,
  "minute": 0,
  "second": 0,
  "timezone": "America/Los_Angeles"
}
```

#### 6. Auto-End Shifts

Automatically end shifts after X hours:

```json
"shifts": {
  "autoEndAfterHours": 10,
  "autoEndEnabled": false
}
```

**autoEndAfterHours:**
- Number of hours before auto-ending
- Prevents shifts from staying open forever

**autoEndEnabled:**
- `true` = Enable auto-end
- `false` = Disable (manual end only)

#### 7. Notifications (Future Feature)

```json
"notifications": {
  "quotaWarningPercentage": 75,
  "quotaReminderPercentage": 50
}
```

*Note: Not currently implemented*

#### 8. Channels

Discord channels for bot messages:

```json
"channels": {
  "shiftLog": "CHANNEL_ID",
  "activeShifts": "CHANNEL_ID",
  "auditLog": "CHANNEL_ID"
}
```

**shiftLog:**
- Posts when shifts start/end
- Shows shift details and progress

**activeShifts:**
- Live updating embed
- Shows all currently active shifts
- Updates every 30 seconds

**auditLog:**
- Logs admin actions
- Edit shift, delete shift, reset quota, etc.

---

## Troubleshooting

### Bot Won't Start

**Error: "No server configs found"**
```
❌ No server configs found in config/ directory.
```
**Solution:** Create at least one config file: `config/{GUILD_ID}.json`

**Error: "Failed to load server configs"**
```
Failed to load server configs: SyntaxError: Unexpected token
```
**Solution:** Your JSON syntax is invalid. Use a JSON validator or check for:
- Missing commas
- Extra commas
- Unclosed brackets
- Quotes around strings

**Error: "An invalid token was provided"**
```
Error [TokenInvalid]: An invalid token was provided.
```
**Solution:** Check your `.env` file:
- `DISCORD_TOKEN` is set correctly
- No extra spaces
- Token is valid (regenerate if needed)

### Commands Not Showing in Discord

**1. Wait 1-2 Minutes**
Discord takes time to sync commands.

**2. Refresh Discord**
- Windows/Linux: `Ctrl+R`
- Mac: `Cmd+R`

**3. Check Console Logs**
```bash
✅ Successfully registered commands for guild XXXX
```

**4. Check Bot Permissions**
- Bot has "applications.commands" scope
- Bot is in the server
- Bot has required permissions

### Permission Errors

**Error: "You do not have permission"**

**Check:**
1. Your Discord role ID is in the config
2. Role ID matches exactly (no typos)
3. You have the role in Discord
4. Config file is for the correct guild

**Verify Role IDs:**
```bash
cat config/YOUR_GUILD_ID.json | grep -A 10 "permissions"
```

### Data Not Showing

**No shifts showing:**
- Have you started any shifts?
- Check you're in the right server
- Check quota cycle exists (bot creates it on start)

**Wrong quota cycle:**
- Bot creates a new 7-day cycle on first start
- Use `/reset_quota` to manually reset (Chief only)

### Channel Not Found

**Error: "Cannot send messages to channel"**

**Check:**
1. Channel IDs are correct
2. Bot has permission to:
   - View Channel
   - Send Messages
   - Embed Links
3. Channel exists and bot can see it

---

## Advanced Topics

### Multiple Servers Same Bot

**YES!** That's the whole point of this system.

1. Create config for Server 1: `config/{GUILD_1}.json`
2. Create config for Server 2: `config/{GUILD_2}.json`
3. Restart bot
4. Both servers work independently!

**Data Isolation:**
- Server 1 data in `databases/{GUILD_1}.db`
- Server 2 data in `databases/{GUILD_2}.db`
- No data sharing
- No permission leakage

### Backing Up Data

**Backup a Single Server:**
```bash
cp databases/YOUR_GUILD_ID.db backups/YOUR_GUILD_ID_$(date +%Y%m%d).db
cp config/YOUR_GUILD_ID.json backups/YOUR_GUILD_ID_config_$(date +%Y%m%d).json
```

**Backup All Servers:**
```bash
mkdir -p backups
cp -r databases/ backups/databases_$(date +%Y%m%d)/
cp -r config/ backups/config_$(date +%Y%m%d)/
```

### Restoring Data

**Restore a Server:**
```bash
cp backups/YOUR_GUILD_ID_20260113.db databases/YOUR_GUILD_ID.db
npm start
```

### Migrating to a New Server

**Scenario:** You want to move your department to a new Discord server.

1. **Get New Guild ID** from new server
2. **Copy existing config:**
   ```bash
   cp config/OLD_GUILD_ID.json config/NEW_GUILD_ID.json
   ```
3. **Update NEW_GUILD_ID.json:**
   - All role IDs (new server has different IDs)
   - All channel IDs
   - Keep quotas, cycles, etc. the same
4. **Optional: Copy database if you want to keep history:**
   ```bash
   cp databases/OLD_GUILD_ID.db databases/NEW_GUILD_ID.db
   ```
5. **Restart bot**

### Removing a Server

1. **Stop the bot**
2. **Delete config file:**
   ```bash
   rm config/GUILD_ID.json
   ```
3. **Optional: Delete database (loses all data!):**
   ```bash
   rm databases/GUILD_ID.db
   ```
4. **Restart bot**

### Changing Bot Token

**If you need to regenerate your bot token:**

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to "Bot" section
4. Click "Reset Token"
5. Copy new token
6. Update `.env` file:
   ```env
   DISCORD_TOKEN=new_token_here
   ```
7. Restart bot

### Development Mode

**Running in Development:**
```bash
npm run dev
```

**Watching for Changes:**
```bash
npm run watch
```

This will automatically recompile TypeScript when you make changes.

---

## Quick Reference Card

### File Structure
```
config/{GUILD_ID}.json     ← Server configuration
databases/{GUILD_ID}.db    ← Server database
.env                       ← Bot token & client ID
```

### Common Commands
```bash
npm install           # Install dependencies
npm run build        # Build TypeScript
npm start            # Start bot
npm run dev          # Development mode
```

### Discord Commands
```
/start_shift         # Start your shift
/end_shift          # End your shift
/check_activity     # Check your stats
/activity_report    # Unit report (Supervisor)
/edit_shift         # Edit a shift (Supervisor)
/delete_shift       # Delete a shift (Supervisor)
/reset_quota        # Reset quotas (Chief)
/set_quota          # Change quota (Chief)
```

### Getting IDs
- **Guild ID:** Right-click server → Copy Server ID
- **Role ID:** Right-click role → Copy Role ID
- **Channel ID:** Right-click channel → Copy Channel ID
- **User ID:** Right-click user → Copy User ID

*(Requires Developer Mode enabled)*

---

## Support

### Common Issues Quick Links

- [Bot Won't Start](#bot-wont-start)
- [Commands Not Showing](#commands-not-showing-in-discord)
- [Permission Errors](#permission-errors)
- [Data Not Showing](#data-not-showing)
- [Channel Not Found](#channel-not-found)

### Need Help?

1. Check console logs for errors
2. Verify your configuration
3. Check Discord Developer Portal for bot status
4. Review this guide

---

## Example: Complete Setup Walkthrough

Let's set up a server from scratch!

**Server:** Los Santos Police Department
**Guild ID:** `9876543210123456789` (example)

### 1. Copy Template
```bash
cp config/TEMPLATE.json config/9876543210123456789.json
```

### 2. Edit Configuration
```json
{
  "name": "Los Santos Police Department",
  "permissions": {
    "command": {
      "Police Commissioner": "111111111111111111"
    },
    "supervisor": {
      "Captain": "222222222222222222",
      "Lieutenant": "333333333333333333"
    },
    "employee": {
      "Police Officer": "444444444444444444"
    }
  },
  "unitRoles": {
    "Patrol Division": ["555555555555555555"],
    "Detective Bureau": ["666666666666666666"],
    "SWAT": ["777777777777777777"]
  },
  "quotas": {
    "defaultMinutes": 60,
    "unitQuotas": {
      "Patrol Division": 180,
      "Detective Bureau": 120,
      "SWAT": 90
    }
  },
  "quotaCycle": {
    "dayOfWeek": 0,
    "hour": 23,
    "minute": 59,
    "second": 0,
    "timezone": "America/Los_Angeles"
  },
  "shifts": {
    "autoEndAfterHours": 12,
    "autoEndEnabled": false
  },
  "notifications": {
    "quotaWarningPercentage": 75,
    "quotaReminderPercentage": 50
  },
  "channels": {
    "shiftLog": "888888888888888888",
    "activeShifts": "999999999999999999",
    "auditLog": "101010101010101010"
  }
}
```

### 3. Start Bot
```bash
npm start
```

### 4. Success!
```
✅ Loaded config for guild 9876543210123456789 (Los Santos Police Department)
✅ Database initialized for guild 9876543210123456789
✅ Successfully registered commands for guild 9876543210123456789
```

Done! Your server is ready to use. 🎉

---

**Last Updated:** January 13, 2026
**Bot Version:** Multi-Server v2.0
