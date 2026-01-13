import Database from 'better-sqlite3';
import { join } from 'path';
import { Shift, QuotaCycle, AuditLog } from '../types';

let db: Database.Database;

export function initDatabase(): void {
  const dbPath = join(__dirname, '../../database/activity.db');
  db = new Database(dbPath);

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
    CREATE INDEX IF NOT EXISTS idx_quota_cycles_active ON quota_cycles(is_active);
  `);

  console.log('✅ Database initialized');
}

export function getDatabase(): Database.Database {
  return db;
}

// Quota Cycle Functions
export function getActiveQuotaCycle(): QuotaCycle | null {
  const row = db.prepare('SELECT * FROM quota_cycles WHERE is_active = 1 LIMIT 1').get() as any;
  if (!row) return null;

  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active === 1
  };
}

export function createQuotaCycle(startDate: number, endDate: number): QuotaCycle {
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

export function deactivateAllQuotaCycles(): void {
  db.prepare('UPDATE quota_cycles SET is_active = 0').run();
}

export function resetQuotaCycle(): QuotaCycle {
  deactivateAllQuotaCycles();

  const now = Date.now();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7); // Default 7 days

  return createQuotaCycle(now, endDate.getTime());
}

// Shift Functions
export function startShift(
  userId: string,
  username: string,
  unitRole: string,
  pictureLink: string,
  quotaCycleId: number
): Shift {
  const startTime = Date.now();

  const result = db.prepare(`
    INSERT INTO shifts (user_id, username, unit_role, start_time, start_picture_link, quota_cycle_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(userId, username, unitRole, startTime, pictureLink, quotaCycleId);

  return {
    id: result.lastInsertRowid as number,
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

export function endShift(shiftId: number, endPictureLink: string): Shift | null {
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId) as any;
  if (!shift) return null;

  const endTime = Date.now();
  const durationMinutes = Math.floor((endTime - shift.start_time) / 1000 / 60);

  db.prepare(`
    UPDATE shifts
    SET end_time = ?, duration_minutes = ?, end_picture_link = ?, is_active = 0
    WHERE id = ?
  `).run(endTime, durationMinutes, endPictureLink, shiftId);

  return {
    id: shift.id,
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

export function getActiveShiftForUser(userId: string): Shift | null {
  const row = db.prepare('SELECT * FROM shifts WHERE user_id = ? AND is_active = 1 LIMIT 1').get(userId) as any;
  if (!row) return null;

  return {
    id: row.id,
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

export function getAllActiveShifts(): Shift[] {
  const rows = db.prepare('SELECT * FROM shifts WHERE is_active = 1 ORDER BY start_time DESC').all() as any[];

  return rows.map(row => ({
    id: row.id,
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

export function getUserShiftsInCycle(userId: string, quotaCycleId: number): Shift[] {
  const rows = db.prepare(`
    SELECT * FROM shifts
    WHERE user_id = ? AND quota_cycle_id = ?
    ORDER BY start_time DESC
  `).all(userId, quotaCycleId) as any[];

  return rows.map(row => ({
    id: row.id,
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

export function getUnitShiftsInCycle(unitRole: string, quotaCycleId: number): Shift[] {
  const rows = db.prepare(`
    SELECT * FROM shifts
    WHERE unit_role = ? AND quota_cycle_id = ?
    ORDER BY start_time DESC
  `).all(unitRole, quotaCycleId) as any[];

  return rows.map(row => ({
    id: row.id,
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

export function updateShiftDuration(shiftId: number, newDurationMinutes: number): boolean {
  const result = db.prepare(`
    UPDATE shifts
    SET duration_minutes = ?
    WHERE id = ?
  `).run(newDurationMinutes, shiftId);

  return result.changes > 0;
}

export function deleteShift(shiftId: number): boolean {
  const result = db.prepare('DELETE FROM shifts WHERE id = ?').run(shiftId);
  return result.changes > 0;
}

export function getTotalMinutesForUserInCycle(userId: string, quotaCycleId: number): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(duration_minutes), 0) as total
    FROM shifts
    WHERE user_id = ? AND quota_cycle_id = ? AND duration_minutes IS NOT NULL
  `).get(userId, quotaCycleId) as any;

  return result.total;
}

// Audit Log Functions
export function addAuditLog(
  adminId: string,
  adminUsername: string,
  action: string,
  targetUserId: string | null,
  details: string
): void {
  db.prepare(`
    INSERT INTO audit_logs (timestamp, admin_id, admin_username, action, target_user_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Date.now(), adminId, adminUsername, action, targetUserId, details);
}

export function getRecentAuditLogs(limit: number = 50): AuditLog[] {
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

export function deleteShiftsForUserInCycle(userId: string, quotaCycleId: number): number {
  const result = db.prepare(`
    DELETE FROM shifts
    WHERE user_id = ? AND quota_cycle_id = ?
  `).run(userId, quotaCycleId);

  return result.changes;
}

export function deleteShiftsForUnitInCycle(unitRole: string, quotaCycleId: number): number {
  const result = db.prepare(`
    DELETE FROM shifts
    WHERE unit_role = ? AND quota_cycle_id = ?
  `).run(unitRole, quotaCycleId);

  return result.changes;
}

export function deleteAllShiftsInCycle(quotaCycleId: number): number {
  const result = db.prepare(`
    DELETE FROM shifts
    WHERE quota_cycle_id = ?
  `).run(quotaCycleId);

  return result.changes;
}
