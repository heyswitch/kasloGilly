export interface Config {
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
}

export interface Shift {
  id: number;
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
