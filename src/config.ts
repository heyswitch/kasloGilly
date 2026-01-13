import { readFileSync } from 'fs';
import { join } from 'path';
import { Config } from './types';

let config: Config;

export function loadConfig(): Config {
  try {
    const configPath = join(__dirname, '../config/config.json');
    const configData = readFileSync(configPath, 'utf-8');
    config = JSON.parse(configData);
    return config;
  } catch (error) {
    console.error('Failed to load config.json:', error);
    process.exit(1);
  }
}

export function getConfig(): Config {
  if (!config) {
    return loadConfig();
  }
  return config;
}

export function getNextQuotaCycleEnd(): Date {
  const cfg = getConfig();
  const now = new Date();

  // Convert to the configured timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: cfg.quotaCycle.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);

  const currentDate = new Date();
  const targetDay = cfg.quotaCycle.dayOfWeek;
  const currentDay = currentDate.getDay();

  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7;
  }

  const nextCycleEnd = new Date(currentDate);
  nextCycleEnd.setDate(currentDate.getDate() + daysUntilTarget);
  nextCycleEnd.setHours(cfg.quotaCycle.hour, cfg.quotaCycle.minute, cfg.quotaCycle.second, 0);

  return nextCycleEnd;
}

export function hasCommandPermission(roleIds: string[]): boolean {
  const cfg = getConfig();
  const commandRoleIds = Object.values(cfg.permissions.command);
  return roleIds.some(roleId => commandRoleIds.includes(roleId));
}

export function hasSupervisorPermission(roleIds: string[]): boolean {
  const cfg = getConfig();
  const supervisorRoleIds = Object.values(cfg.permissions.supervisor);
  const commandRoleIds = Object.values(cfg.permissions.command);
  return roleIds.some(roleId =>
    supervisorRoleIds.includes(roleId) || commandRoleIds.includes(roleId)
  );
}

export function hasEmployeePermission(roleIds: string[]): boolean {
  const cfg = getConfig();
  const employeeRoleIds = Object.values(cfg.permissions.employee);
  const supervisorRoleIds = Object.values(cfg.permissions.supervisor);
  const commandRoleIds = Object.values(cfg.permissions.command);
  return roleIds.some(roleId =>
    employeeRoleIds.includes(roleId) || supervisorRoleIds.includes(roleId) || commandRoleIds.includes(roleId)
  );
}

export function getUserUnitRoles(roleIds: string[]): string[] {
  const cfg = getConfig();
  const units: string[] = [];

  for (const [unitName, unitRoleIds] of Object.entries(cfg.unitRoles)) {
    if (roleIds.some(roleId => unitRoleIds.includes(roleId))) {
      units.push(unitName);
    }
  }

  return units;
}

export function getQuotaForUnit(unitRole: string): number {
  const cfg = getConfig();
  return cfg.quotas.unitQuotas[unitRole] || cfg.quotas.defaultMinutes;
}
