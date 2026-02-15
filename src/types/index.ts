// Terminology configuration for customizable display names
export interface Terminology {
  loa: string;
  adminLeave: string;
  promotion: string;
  demotion: string;
  transfer: string;
  discharge: string;
  hire: string;
  probation: string;
  suspension: string;
  ztp: string;
  warning: string;
}

// Server-specific configuration
export interface ServerConfig {
  name: string;
  permissions: {
    command: Record<string, string>;
    supervisor: Record<string, string>;
    employee: Record<string, string>;
  };
  unitRoles: Record<string, string[]>;
  quotas: {
    defaultMinutes: number;
    unitQuotas: Record<string, number>;
  };
  quotaCycle: {
    dayOfWeek: number; // 0 = Sunday, 6 = Saturday
    hour: number;
    minute: number;
    second: number;
    timezone: string;
  };
  shifts: {
    autoEndAfterHours: number;
    autoEndEnabled: boolean;
  };
  notifications: {
    quotaWarningPercentage: number;
    quotaReminderPercentage: number;
  };
  channels: {
    shiftLog: string;
    activeShifts: string;
    auditLog: string;
    departmentLog: string;
  };
  departmentFullName: string;
  terminology?: Terminology;
}

// Global config maps guild IDs to server configs
export interface Config {
  servers: Record<string, ServerConfig>;
}

export interface Shift {
  id: number;
  shiftCode: string; // Cryptographically secure random ID
  userId: string;
  username: string;
  unitRole: string;
  startTime: number; // Unix timestamp
  endTime: number | null; // Unix timestamp or null if active
  durationMinutes: number | null;
  startPictureLink: string;
  endPictureLink: string | null;
  quotaCycleId: number;
  isActive: boolean;
}

export interface QuotaCycle {
  id: number;
  startDate: number; // Unix timestamp
  endDate: number; // Unix timestamp
  isActive: boolean;
}

export interface UserQuotaStats {
  userId: string;
  username: string;
  unitRole: string;
  totalMinutes: number;
  quotaMinutes: number;
  quotaMet: boolean;
  shifts: Shift[];
}

export interface AuditLog {
  id: number;
  timestamp: number;
  adminId: string;
  adminUsername: string;
  action: string;
  targetUserId: string | null;
  details: string;
}

// Department Action Types
export type DepartmentActionType =
  | 'LOA'
  | 'ADMIN_LEAVE'
  | 'PROMOTION'
  | 'DEMOTION'
  | 'TRANSFER'
  | 'DISCHARGE'
  | 'HIRE'
  | 'PROBATION'
  | 'SUSPENSION'
  | 'ZTP'
  | 'WARNING';

export type DischargeType = 'HONORABLE' | 'RESIGNATION' | 'TERMINATION';

export interface DepartmentAction {
  id: number;
  actionType: DepartmentActionType;
  targetUserId: string;
  targetUsername: string;
  adminUserId: string;
  adminUsername: string;
  notes: string | null;
  isActive: boolean;
  createdAt: number;
  endDate: number | null;
  removedAt: number | null;
  removedByUserId: string | null;
  removedByUsername: string | null;
  previousRank: string | null;
  newRank: string | null;
  previousUnit: string | null;
  newUnit: string | null;
  dischargeType: DischargeType | null;
  messageId: string | null;
}

export interface CreateDepartmentAction {
  actionType: DepartmentActionType;
  targetUserId: string;
  targetUsername: string;
  adminUserId: string;
  adminUsername: string;
  notes?: string;
  endDate?: number;
  previousRank?: string;
  newRank?: string;
  previousUnit?: string;
  newUnit?: string;
  dischargeType?: DischargeType;
}
