import Database from 'better-sqlite3';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { Shift, QuotaCycle, AuditLog } from '../types';

// Database connection manager: Map<guildId, Database>
const databases = new Map<string, Database.Database>();

/**
 * Generates a cryptographically secure random shift code
 * Format: 8 characters, alphanumeric (uppercase), ~2.8 trillion possible combinations
 */
function generateShiftCode(): string {
  const bytes = randomBytes(6);
  return bytes.toString('base64')
    .replace(/[+/=]/g, '') // Remove special chars
    .substring(0, 8)
    .toUpperCase();
}

/**
 * Initialize database for a specific guild
 */
export function initDatabase(guildId: string): void {
  const dbDir = join(__dirname, '../../databases');

  // Create databases directory if it doesn't exist
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = join(dbDir, `${guildId}.db`);
  const db = new Database(dbPath);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS quota_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date INTEGER NOT NULL,
      end_date INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS shifts (
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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      admin_id TEXT NOT NULL,
      admin_username TEXT NOT NULL,
      action TEXT NOT NULL,
      target_user_id TEXT,
      details TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_quota_cycle ON shifts(quota_cycle_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_active ON shifts(is_active);
    CREATE INDEX IF NOT EXISTS idx_shifts_code ON shifts(shift_code);
    CREATE INDEX IF NOT EXISTS idx_quota_cycles_active ON quota_cycles(is_active);
  `);

  databases.set(guildId, db);
  console.log(`✅ Database initialized for guild ${guildId}`);
}

/**
 * Initialize databases for all guilds
 */
export function initAllDatabases(guildIds: string[]): void {
  for (const guildId of guildIds) {
    initDatabase(guildId);
  }
}

/**
 * Get database instance for a specific guild
 */
export function getDatabase(guildId: string): Database.Database {
  const db = databases.get(guildId);
  if (!db) {
    throw new Error(`Database not initialized for guild ${guildId}`);
  }
  return db;
}

// Quota Cycle Functions
export function getActiveQuotaCycle(guildId: string): QuotaCycle | null {
  const db = getDatabase(guildId);
  const row = db.prepare('SELECT * FROM quota_cycles WHERE is_active = 1 LIMIT 1').get() as any;
  if (!row) return null;

  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active === 1
  };
}

export function createQuotaCycle(guildId: string, startDate: number, endDate: number): QuotaCycle {
  const db = getDatabase(guildId);
  const result = db.prepare(
    'INSERT INTO quota_cycles (start_date, end_date, is_active) VALUES (?, ?, 1)'
  ).run(startDate, endDate);

  return {
    id: result.lastInsertRowid as number,
    startDate,
    endDate,
    isActive: true
  };
}

export function deactivateAllQuotaCycles(guildId: string): void {
  const db = getDatabase(guildId);
  db.prepare('UPDATE quota_cycles SET is_active = 0').run();
}

export function resetQuotaCycle(guildId: string): QuotaCycle {
  deactivateAllQuotaCycles(guildId);

  const now = Date.now();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7); // Default 7 days

  return createQuotaCycle(guildId, now, endDate.getTime());
}

// Shift Functions
export function startShift(
  guildId: string,
  userId: string,
  username: string,
  unitRole: string,
  pictureLink: string,
  quotaCycleId: number
): Shift {
  const db = getDatabase(guildId);
  const startTime = Date.now();
  const shiftCode = generateShiftCode();

  const result = db.prepare(`
    INSERT INTO shifts (shift_code, user_id, username, unit_role, start_time, start_picture_link, quota_cycle_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(shiftCode, userId, username, unitRole, startTime, pictureLink, quotaCycleId);

  return {
    id: result.lastInsertRowid as number,
    shiftCode,
    userId,
    username,
    unitRole,
    startTime,
    endTime: null,
    durationMinutes: null,
    startPictureLink: pictureLink,
    endPictureLink: null,
    quotaCycleId,
    isActive: true
  };
}

export function endShift(guildId: string, shiftId: number, endPictureLink: string): Shift | null {
  const db = getDatabase(guildId);
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId) as any;
  if (!shift) return null;

  const endTime = Date.now();
  const durationMinutes = (endTime - shift.start_time) / 1000 / 60; // Keep decimal for seconds precision

  db.prepare(`
    UPDATE shifts
    SET end_time = ?, duration_minutes = ?, end_picture_link = ?, is_active = 0
    WHERE id = ?
  `).run(endTime, durationMinutes, endPictureLink, shiftId);

  return {
    id: shift.id,
    shiftCode: shift.shift_code,
    userId: shift.user_id,
    username: shift.username,
    unitRole: shift.unit_role,
    startTime: shift.start_time,
    endTime,
    durationMinutes,
    startPictureLink: shift.start_picture_link,
    endPictureLink,
    quotaCycleId: shift.quota_cycle_id,
    isActive: false
  };
}

export function getActiveShiftForUser(guildId: string, userId: string): Shift | null {
  const db = getDatabase(guildId);
  const row = db.prepare('SELECT * FROM shifts WHERE user_id = ? AND is_active = 1 LIMIT 1').get(userId) as any;
  if (!row) return null;

  return {
    id: row.id,
    shiftCode: row.shift_code,
    userId: row.user_id,
    username: row.username,
    unitRole: row.unit_role,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    startPictureLink: row.start_picture_link,
    endPictureLink: row.end_picture_link,
    quotaCycleId: row.quota_cycle_id,
    isActive: row.is_active === 1
  };
}

export function getAllActiveShifts(guildId: string): Shift[] {
  const db = getDatabase(guildId);
  const rows = db.prepare('SELECT * FROM shifts WHERE is_active = 1 ORDER BY start_time DESC').all() as any[];

  return rows.map(row => ({
    id: row.id,
    shiftCode: row.shift_code,
    userId: row.user_id,
    username: row.username,
    unitRole: row.unit_role,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    startPictureLink: row.start_picture_link,
    endPictureLink: row.end_picture_link,
    quotaCycleId: row.quota_cycle_id,
    isActive: row.is_active === 1
  }));
}

export function getUserShiftsInCycle(guildId: string, userId: string, quotaCycleId: number): Shift[] {
  const db = getDatabase(guildId);
  const rows = db.prepare(`
    SELECT * FROM shifts
    WHERE user_id = ? AND quota_cycle_id = ?
    ORDER BY start_time DESC
  `).all(userId, quotaCycleId) as any[];

  return rows.map(row => ({
    id: row.id,
    shiftCode: row.shift_code,
    userId: row.user_id,
    username: row.username,
    unitRole: row.unit_role,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    startPictureLink: row.start_picture_link,
    endPictureLink: row.end_picture_link,
    quotaCycleId: row.quota_cycle_id,
    isActive: row.is_active === 1
  }));
}

export function getUnitShiftsInCycle(guildId: string, unitRole: string, quotaCycleId: number): Shift[] {
  const db = getDatabase(guildId);
  const rows = db.prepare(`
    SELECT * FROM shifts
    WHERE unit_role = ? AND quota_cycle_id = ?
    ORDER BY start_time DESC
  `).all(unitRole, quotaCycleId) as any[];

  return rows.map(row => ({
    id: row.id,
    shiftCode: row.shift_code,
    userId: row.user_id,
    username: row.username,
    unitRole: row.unit_role,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    startPictureLink: row.start_picture_link,
    endPictureLink: row.end_picture_link,
    quotaCycleId: row.quota_cycle_id,
    isActive: row.is_active === 1
  }));
}

export function getShiftByCode(guildId: string, shiftCode: string): Shift | null {
  const db = getDatabase(guildId);
  const row = db.prepare('SELECT * FROM shifts WHERE shift_code = ?').get(shiftCode.toUpperCase()) as any;
  if (!row) return null;

  return {
    id: row.id,
    shiftCode: row.shift_code,
    userId: row.user_id,
    username: row.username,
    unitRole: row.unit_role,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    startPictureLink: row.start_picture_link,
    endPictureLink: row.end_picture_link,
    quotaCycleId: row.quota_cycle_id,
    isActive: row.is_active === 1
  };
}

export function updateShiftDuration(guildId: string, shiftId: number, newDurationMinutes: number): boolean {
  const db = getDatabase(guildId);
  const result = db.prepare(`
    UPDATE shifts
    SET duration_minutes = ?
    WHERE id = ?
  `).run(newDurationMinutes, shiftId);

  return result.changes > 0;
}

export function updateShiftDurationByCode(guildId: string, shiftCode: string, newDurationMinutes: number): boolean {
  const db = getDatabase(guildId);
  const result = db.prepare(`
    UPDATE shifts
    SET duration_minutes = ?
    WHERE shift_code = ?
  `).run(newDurationMinutes, shiftCode.toUpperCase());

  return result.changes > 0;
}

export function deleteShift(guildId: string, shiftId: number): boolean {
  const db = getDatabase(guildId);
  const result = db.prepare('DELETE FROM shifts WHERE id = ?').run(shiftId);
  return result.changes > 0;
}

export function deleteShiftByCode(guildId: string, shiftCode: string): boolean {
  const db = getDatabase(guildId);
  const result = db.prepare('DELETE FROM shifts WHERE shift_code = ?').run(shiftCode.toUpperCase());
  return result.changes > 0;
}

export function getTotalMinutesForUserInCycle(guildId: string, userId: string, quotaCycleId: number): number {
  const db = getDatabase(guildId);
  const result = db.prepare(`
    SELECT COALESCE(SUM(duration_minutes), 0) as total
    FROM shifts
    WHERE user_id = ? AND quota_cycle_id = ? AND duration_minutes IS NOT NULL
  `).get(userId, quotaCycleId) as any;

  return result.total;
}

// Audit Log Functions
export function addAuditLog(
  guildId: string,
  adminId: string,
  adminUsername: string,
  action: string,
  targetUserId: string | null,
  details: string
): void {
  const db = getDatabase(guildId);
  db.prepare(`
    INSERT INTO audit_logs (timestamp, admin_id, admin_username, action, target_user_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Date.now(), adminId, adminUsername, action, targetUserId, details);
}

export function getRecentAuditLogs(guildId: string, limit: number = 50): AuditLog[] {
  const db = getDatabase(guildId);
  const rows = db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    adminId: row.admin_id,
    adminUsername: row.admin_username,
    action: row.action,
    targetUserId: row.target_user_id,
    details: row.details
  }));
}

export function deleteShiftsForUserInCycle(guildId: string, userId: string, quotaCycleId: number): number {
  const db = getDatabase(guildId);
  const result = db.prepare(`
    DELETE FROM shifts
    WHERE user_id = ? AND quota_cycle_id = ?
  `).run(userId, quotaCycleId);

  return result.changes;
}

export function deleteShiftsForUnitInCycle(guildId: string, unitRole: string, quotaCycleId: number): number {
  const db = getDatabase(guildId);
  const result = db.prepare(`
    DELETE FROM shifts
    WHERE unit_role = ? AND quota_cycle_id = ?
  `).run(unitRole, quotaCycleId);

  return result.changes;
}

export function deleteAllShiftsInCycle(guildId: string, quotaCycleId: number): number {
  const db = getDatabase(guildId);
  const result = db.prepare(`
    DELETE FROM shifts
    WHERE quota_cycle_id = ?
  `).run(quotaCycleId);

  return result.changes;
}
