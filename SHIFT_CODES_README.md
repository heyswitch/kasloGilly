# Shift Code System

## Overview
Shifts now use cryptographically secure random codes instead of sequential numeric IDs for better security and to prevent ID exhaustion.

## Shift Code Format
- **Length:** 8 characters
- **Character Set:** Alphanumeric (A-Z, 0-9), uppercase
- **Example:** `JE6RGXLT`, `ABC12345`, `XY9Z4MNP`
- **Uniqueness:** Cryptographically random with ~2.8 trillion possible combinations
- **Collision Probability:** Virtually zero

## How to Use Shift Codes

### For Regular Users

#### Check Your Shifts
Run `/check_activity` to see your shift history. Each shift will display with its code:
```
1. 🔴 Ended - January 13, 2026 at 2:24PM - 45 minutes (Code: JE6RGXLT)
2. 🟢 Active - January 14, 2026 at 1:15PM - In Progress (Code: ABC12345)
```

### For Supervisors

#### Edit a Shift
```
/edit_shift shift_code:JE6RGXLT new_minutes:60 reason:Corrected time based on logs
```

#### Delete a Shift
```
/delete_shift shift_code:JE6RGXLT reason:Duplicate entry
```

## Technical Details

### Code Generation
- Uses Node.js `crypto.randomBytes()` for cryptographic randomness
- Generated during shift creation in the `startShift()` function
- Automatically converted to uppercase for consistency

### Database Schema
```sql
CREATE TABLE shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_code TEXT NOT NULL UNIQUE,
  -- ... other fields
);
```

### Benefits
1. **Security:** Random codes are harder to guess than sequential IDs
2. **Scalability:** Will never run out of shift codes
3. **Obfuscation:** Doesn't reveal how many total shifts exist
4. **Collision-resistant:** Cryptographic randomness ensures uniqueness

## Migration

The database was migrated using `migrate_add_shift_codes.js` which:
1. Added the `shift_code` column
2. Generated unique random codes for all existing shifts
3. Applied NOT NULL and UNIQUE constraints
4. Created an index for fast lookups

## API Functions

### Get Shift by Code
```javascript
const shift = getShiftByCode('JE6RGXLT');
```

### Update Shift by Code
```javascript
const success = updateShiftDurationByCode('JE6RGXLT', 60);
```

### Delete Shift by Code
```javascript
const success = deleteShiftByCode('JE6RGXLT');
```

## Notes
- Shift codes are case-insensitive (automatically converted to uppercase)
- The numeric `id` field still exists for internal database operations
- All user-facing commands now use shift codes instead of IDs
