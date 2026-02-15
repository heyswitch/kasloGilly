import { Client, TextChannel, EmbedBuilder, ColorResolvable } from 'discord.js';
import { DepartmentAction, DepartmentActionType } from '../types';
import { formatTimestamp } from '../utils/timeFormatter';
import { getServerConfig, getActionTerminology } from '../config';

const ACTION_COLORS: Record<DepartmentActionType, ColorResolvable> = {
  LOA: "#6e1dc4",
  ADMIN_LEAVE: "#7a1717",
  PROMOTION: "#25a326",
  DEMOTION: "#c27615",
  TRANSFER: "#EDD055",
  DISCHARGE: "#e019d0",
  HIRE: "#6db0ff",
  PROBATION: "#ff9800",
  SUSPENSION: "#d32f2f",
  ZTP: "#b71c1c",
  WARNING: "#ffeb3b"
};

function getActionTitle(guildId: string, actionType: DepartmentActionType): string {
  return getActionTerminology(guildId, actionType);
}

function formatDischargeType(type: string | null): string {
  switch (type) {
    case 'HONORABLE':
      return 'Honorable Discharge';
    case 'RESIGNATION':
      return 'Resignation';
    case 'TERMINATION':
      return 'Termination';
    default:
      return 'Unknown';
  }
}

function createDepartmentActionEmbed(action: DepartmentAction, departmentName: string, adminDisplayName: string, guildId: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('Department Action')
    .setColor(ACTION_COLORS[action.actionType])
    .setTimestamp();

  let description = '';
  const actionTitle = getActionTitle(guildId, action.actionType);

  switch (action.actionType) {
    case 'LOA':
      if (action.endDate) {
        description = `**${action.targetUsername}** is now on a **${actionTitle}** until ${formatTimestamp(action.endDate)}.`;
      } else {
        description = `**${action.targetUsername}** is now on a **${actionTitle}**.`;
      }
      break;

    case 'ADMIN_LEAVE':
      description = `**${action.targetUsername}** has been placed on **${actionTitle}**.`;
      break;

    case 'PROMOTION':
      if (action.previousRank && action.newRank) {
        description = `**${action.targetUsername}** has been **promoted** from ${action.previousRank} to **${action.newRank}**.`;
      } else if (action.newRank) {
        description = `**${action.targetUsername}** has been **promoted** to **${action.newRank}**.`;
      } else {
        description = `**${action.targetUsername}** has been **promoted**.`;
      }
      break;

    case 'DEMOTION':
      if (action.previousRank && action.newRank) {
        description = `**${action.targetUsername}** has been **demoted** from ${action.previousRank} to **${action.newRank}**.`;
      } else if (action.newRank) {
        description = `**${action.targetUsername}** has been **demoted** to **${action.newRank}**.`;
      } else {
        description = `**${action.targetUsername}** has been **demoted**.`;
      }
      break;

    case 'TRANSFER':
      if (action.previousUnit && action.newUnit) {
        description = `**${action.targetUsername}** has been **transferred** from ${action.previousUnit} to **${action.newUnit}**.`;
      } else if (action.newUnit) {
        description = `**${action.targetUsername}** has been **transferred** into **${action.newUnit}**.`;
      } else {
        description = `**${action.targetUsername}** has been **transferred**.`;
      }
      break;

    case 'DISCHARGE':
      const dischargeText = formatDischargeType(action.dischargeType);
      if (action.dischargeType === 'RESIGNATION') {
        description = `**${action.targetUsername}** has been issued a **Honorable Discharge** after **resigning** from the ${departmentName}.`;
      } else if (action.dischargeType === 'TERMINATION') {
        description = `**${action.targetUsername}** has been **terminated** from the ${departmentName}.`;
      } else {
        description = `**${action.targetUsername}** has been issued a **${dischargeText}** from the ${departmentName}.`;
      }
      break;

    case 'HIRE':
      description = `**${action.targetUsername}** has been **accepted** into the ${departmentName}.`;
      break;

    case 'PROBATION':
      if (action.endDate) {
        description = `**${action.targetUsername}** has been placed on **${actionTitle}** until ${formatTimestamp(action.endDate)}.`;
      } else {
        description = `**${action.targetUsername}** has been placed on **${actionTitle}**.`;
      }
      break;

    case 'SUSPENSION':
      if (action.endDate) {
        description = `**${action.targetUsername}** has been **suspended** until ${formatTimestamp(action.endDate)}.`;
      } else {
        description = `**${action.targetUsername}** has been **suspended**.`;
      }
      break;

    case 'ZTP':
      if (action.endDate) {
        description = `**${action.targetUsername}** has been issued a **${actionTitle}** until ${formatTimestamp(action.endDate)}.`;
      } else {
        description = `**${action.targetUsername}** has been issued a **${actionTitle}**.`;
      }
      break;

    case 'WARNING':
      description = `**${action.targetUsername}** has been issued a **${actionTitle}**.`;
      break;
  }

  embed.setDescription(description);

  if (action.notes) {
    embed.addFields({ name: 'Notes', value: action.notes });
  }

  if (adminDisplayName) {
    embed.setFooter({ text: adminDisplayName });
  }

  return embed;
}

export async function logDepartmentAction(
  client: Client,
  guildId: string,
  action: DepartmentAction
): Promise<string | null> {
  const config = getServerConfig(guildId);
  const channelId = config.channels.departmentLog;
  if (!channelId) return null;

  try {
    const channel = (await client.channels.fetch(channelId)) as TextChannel;
    if (!channel) return null;

    // Get admin's server nickname
    let adminDisplayName = action.adminUsername;
    try {
      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(action.adminUserId);
      adminDisplayName = member.displayName;
    } catch {
      // Fall back to username if member fetch fails
    }

    const embed = createDepartmentActionEmbed(action, config.departmentFullName || config.name, adminDisplayName, guildId);
    const message = await channel.send({ embeds: [embed] });
    return message.id;
  } catch (error) {
    console.error('Error logging department action:', error);
    return null;
  }
}

export async function logLeaveRemoval(
  client: Client,
  guildId: string,
  action: DepartmentAction,
  wasAutoExpired: boolean
): Promise<void> {
  const config = getServerConfig(guildId);
  const channelId = config.channels.departmentLog;
  if (!channelId) return;

  try {
    const channel = (await client.channels.fetch(channelId)) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('Department Action')
      .setColor(0x808080)
      .setTimestamp();

    const actionTitle = getActionTitle(guildId, action.actionType);
    const description = `**${action.targetUsername}** is no longer on a **${actionTitle}**.`;

    embed.setDescription(description);

    // Get remover's server nickname
    let removerDisplayName = action.removedByUsername || 'Unknown';
    if (!wasAutoExpired && action.removedByUserId) {
      try {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(action.removedByUserId);
        removerDisplayName = member.displayName;
      } catch {
        // Fall back to username if member fetch fails
      }
    }

    const notes = wasAutoExpired ? 'Automated removal of absence.' : `Removed by ${removerDisplayName}.`;
    embed.addFields({ name: 'Notes', value: notes });

    const adminName = wasAutoExpired ? config.name : removerDisplayName;
    if (adminName) {
      embed.setFooter({ text: adminName });
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error logging leave removal:', error);
  }
}
