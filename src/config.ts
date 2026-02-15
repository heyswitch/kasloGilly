import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ServerConfig, Terminology, DepartmentActionType } from './types';

const serverConfigs: Map<string, ServerConfig> = new Map();

export function loadAllConfigs(): void {
  try {
    const configDir = join(__dirname, '../config');

    if (!existsSync(configDir)) {
      console.error('❌ Config directory not found. Please create config/ directory with server configs.');
      process.exit(1);
    }

    // Read all .json files in config directory
    const configFiles = readdirSync(configDir).filter(f => f.endsWith('.json') && f !== 'TEMPLATE.json');

    if (configFiles.length === 0) {
      console.error('❌ No server configs found in config/ directory.');
      console.error('Please create a config file named {GUILD_ID}.json for each server.');
      process.exit(1);
    }

    for (const file of configFiles) {
      const guildId = file.replace('.json', '');
      const configPath = join(configDir, file);
      const configData = readFileSync(configPath, 'utf-8');
      const config: ServerConfig = JSON.parse(configData);

      serverConfigs.set(guildId, config);
      console.log(`✅ Loaded config for guild ${guildId} (${config.name})`);
    }

    console.log(`✅ Loaded ${serverConfigs.size} server configuration(s)`);
  } catch (error) {
    console.error('Failed to load server configs:', error);
    process.exit(1);
  }
}

export function getServerConfig(guildId: string): ServerConfig {
  const config = serverConfigs.get(guildId);
  if (!config) {
    throw new Error(
      `No configuration found for guild ${guildId}. Please create config/${guildId}.json`
    );
  }
  return config;
}

export function getAllGuildIds(): string[] {
  return Array.from(serverConfigs.keys());
}

export function getNextQuotaCycleEnd(guildId: string): Date {
  const cfg = getServerConfig(guildId);
  const timezone = cfg.quotaCycle.timezone;
  const now = new Date();

  // Helper to get date/time parts in the configured timezone
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  };

  const formatter = new Intl.DateTimeFormat('en-US', formatOptions);
  const getParts = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
    return {
      year: parseInt(get('year')),
      month: parseInt(get('month')),
      day: parseInt(get('day')),
      hour: parseInt(get('hour')),
      minute: parseInt(get('minute')),
      second: parseInt(get('second')),
      weekday: get('weekday')
    };
  };

  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };

  // Get current time in the configured timezone
  const nowParts = getParts(now);
  const currentDay = dayMap[nowParts.weekday];

  const { dayOfWeek: targetDay, hour: targetHour, minute: targetMinute, second: targetSecond } = cfg.quotaCycle;

  // Calculate days until target day
  let daysUntil = targetDay - currentDay;
  if (daysUntil === 0) {
    // Same day - check if target time has already passed
    const nowSecs = nowParts.hour * 3600 + nowParts.minute * 60 + nowParts.second;
    const targetSecs = targetHour * 3600 + targetMinute * 60 + targetSecond;
    if (nowSecs >= targetSecs) daysUntil = 7;
  } else if (daysUntil < 0) {
    daysUntil += 7;
  }

  // Get the target date in the configured timezone
  const targetDate = new Date(now.getTime() + daysUntil * 86400000);
  const targetParts = getParts(targetDate);

  // Build ISO string for the target datetime (without timezone suffix)
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoStr = `${targetParts.year}-${pad(targetParts.month)}-${pad(targetParts.day)}T${pad(targetHour)}:${pad(targetMinute)}:${pad(targetSecond)}`;

  // Convert from configured timezone to UTC by calculating the offset
  // First, treat the ISO string as UTC to get a reference point
  const utcGuess = new Date(isoStr + 'Z');
  const guessParts = getParts(utcGuess);

  // Calculate the timezone offset in minutes
  let offsetMins = (guessParts.hour - targetHour) * 60 + (guessParts.minute - targetMinute);

  // Handle day boundary crossing (e.g., 23:59 ET = 04:59 UTC next day)
  if (guessParts.day !== targetParts.day) {
    offsetMins += (guessParts.day > targetParts.day ? 1 : -1) * 1440;
  }

  // Subtract the offset to get the correct UTC time
  return new Date(utcGuess.getTime() - offsetMins * 60000);
}

export function hasCommandPermission(roleIds: string[], guildId: string): boolean {
  const cfg = getServerConfig(guildId);
  const commandRoleIds = Object.values(cfg.permissions.command);
  return roleIds.some(roleId => commandRoleIds.includes(roleId));
}

export function hasSupervisorPermission(roleIds: string[], guildId: string): boolean {
  const cfg = getServerConfig(guildId);
  const supervisorRoleIds = Object.values(cfg.permissions.supervisor);
  const commandRoleIds = Object.values(cfg.permissions.command);
  return roleIds.some(roleId =>
    supervisorRoleIds.includes(roleId) || commandRoleIds.includes(roleId)
  );
}

export function hasEmployeePermission(roleIds: string[], guildId: string): boolean {
  const cfg = getServerConfig(guildId);
  const employeeRoleIds = Object.values(cfg.permissions.employee);
  const supervisorRoleIds = Object.values(cfg.permissions.supervisor);
  const commandRoleIds = Object.values(cfg.permissions.command);
  return roleIds.some(roleId =>
    employeeRoleIds.includes(roleId) || supervisorRoleIds.includes(roleId) || commandRoleIds.includes(roleId)
  );
}

export function getUserUnitRoles(roleIds: string[], guildId: string): string[] {
  const cfg = getServerConfig(guildId);
  const units: string[] = [];

  for (const [unitName, unitRoleIds] of Object.entries(cfg.unitRoles)) {
    if (roleIds.some(roleId => unitRoleIds.includes(roleId))) {
      units.push(unitName);
    }
  }

  return units;
}

export function getQuotaForUnit(unitRole: string, guildId: string): number {
  const cfg = getServerConfig(guildId);
  return cfg.quotas.unitQuotas[unitRole] || cfg.quotas.defaultMinutes;
}

export function setQuotaForUnit(unitRole: string, minutes: number, guildId: string): boolean {
  try {
    const cfg = getServerConfig(guildId);

    // Update in memory
    cfg.quotas.unitQuotas[unitRole] = minutes;

    // Write to config file
    const configPath = join(__dirname, '../config', `${guildId}.json`);
    writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');

    return true;
  } catch (error) {
    console.error(`Failed to set quota for ${unitRole} in guild ${guildId}:`, error);
    return false;
  }
}

const DEFAULT_TERMINOLOGY: Terminology = {
  loa: 'Leave of Absence',
  adminLeave: 'Administrative Leave',
  promotion: 'Promotion',
  demotion: 'Demotion',
  transfer: 'Transfer',
  discharge: 'Discharge',
  hire: 'New Hire',
  probation: 'Probation',
  suspension: 'Suspension',
  ztp: 'Zero Tolerance Policy'
};

export function getTerminology(guildId: string): Terminology {
  const cfg = getServerConfig(guildId);
  return {
    ...DEFAULT_TERMINOLOGY,
    ...cfg.terminology
  };
}

export function getActionTerminology(guildId: string, actionType: DepartmentActionType): string {
  const terms = getTerminology(guildId);
  const mapping: Record<DepartmentActionType, string> = {
    LOA: terms.loa,
    ADMIN_LEAVE: terms.adminLeave,
    PROMOTION: terms.promotion,
    DEMOTION: terms.demotion,
    TRANSFER: terms.transfer,
    DISCHARGE: terms.discharge,
    HIRE: terms.hire,
    PROBATION: terms.probation,
    SUSPENSION: terms.suspension,
    ZTP: terms.ztp
  };
  return mapping[actionType];
}
