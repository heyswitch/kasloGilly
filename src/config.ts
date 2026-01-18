import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ServerConfig } from './types';

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
