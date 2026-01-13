/**
 * Migration script to add shift_code column to existing database
 * Run this once with: node migrate_add_shift_codes.js
 */

const Database = require('better-sqlite3');
const { randomBytes } = require('crypto');
const { join } = require('path');

function generateShiftCode() {
  const bytes = randomBytes(6);
  return bytes.toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 8)
    .toUpperCase();
}

const dbPath = join(__dirname, 'database/activity.db');
const db = new Database(dbPath);

console.log('Starting migration...');

try {
  // Check if shift_code column already exists
  const tableInfo = db.pragma('table_info(shifts)');
  const hasShiftCode = tableInfo.some(col => col.name === 'shift_code');

  if (hasShiftCode) {
    console.log('✅ shift_code column already exists. No migration needed.');
    process.exit(0);
  }

  // Add shift_code column
  console.log('Adding shift_code column...');
  db.exec('ALTER TABLE shifts ADD COLUMN shift_code TEXT');

  // Get all shifts
  const shifts = db.prepare('SELECT id FROM shifts').all();
  console.log(`Found ${shifts.length} shifts to update`);

  // Generate unique codes for each shift
  const updateStmt = db.prepare('UPDATE shifts SET shift_code = ? WHERE id = ?');
  const usedCodes = new Set();

  for (const shift of shifts) {
    let code;
    do {
      code = generateShiftCode();
    } while (usedCodes.has(code));

    usedCodes.add(code);
    updateStmt.run(code, shift.id);
  }

  console.log(`✅ Updated ${shifts.length} shifts with unique codes`);

  // Make shift_code column NOT NULL and UNIQUE
  console.log('Creating new table with constraints...');

  db.exec(`
    CREATE TABLE shifts_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_code TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      unit_role TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration_minutes INTEGER,
      start_picture_link TEXT NOT NULL,
      end_picture_link TEXT,
      quota_cycle_id INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (quota_cycle_id) REFERENCES quota_cycles(id)
    );
  `);

  console.log('Copying data to new table...');
  db.exec(`
    INSERT INTO shifts_new
    SELECT id, shift_code, user_id, username, unit_role, start_time, end_time,
           duration_minutes, start_picture_link, end_picture_link, quota_cycle_id, is_active
    FROM shifts;
  `);

  console.log('Replacing old table...');
  db.exec('DROP TABLE shifts;');
  db.exec('ALTER TABLE shifts_new RENAME TO shifts;');

  console.log('Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_quota_cycle ON shifts(quota_cycle_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_active ON shifts(is_active);
    CREATE INDEX IF NOT EXISTS idx_shifts_code ON shifts(shift_code);
  `);

  console.log('✅ Migration completed successfully!');

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
