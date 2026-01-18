import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, AutocompleteInteraction } from 'discord.js';
import { hasCommandPermission, getServerConfig, setQuotaForUnit } from '../config';
import { addAuditLog } from '../database/database';
import { logAuditAction } from '../services/shiftLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_quota')
    .setDescription('Set the activity quota for a unit (Command role only)')
    .addStringOption(option =>
      option
        .setName('unit_role')
        .setDescription('The unit role to set quota for')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(option =>
      option
        .setName('minutes')
        .setDescription('Required minutes per cycle')
        .setRequired(true)
        .setMinValue(0)
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const focusedValue = interaction.options.getFocused().toLowerCase();
    const config = getServerConfig(guildId);
    const unitNames = Object.keys(config.unitRoles);

    const filtered = unitNames
      .filter(name => name.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    await interaction.respond(
      filtered.map(name => ({ name, value: name }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.editReply('❌ This command can only be used in a server.');
    }

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    // Check command permissions
    if (!hasCommandPermission(memberRoleIds, guildId)) {
      return interaction.editReply('❌ You do not have permission to use this command. Only command staff can set quotas.');
    }

    const unitRole = interaction.options.getString('unit_role', true);
    const minutes = interaction.options.getInteger('minutes', true);

    if (minutes < 0) {
      return interaction.editReply('❌ Minutes must be a positive number.');
    }

    // Get config and update
    const config = getServerConfig(guildId);

    // Check if unit role exists
    if (!config.unitRoles[unitRole]) {
      return interaction.editReply(`❌ Invalid unit role. Available units: ${Object.keys(config.unitRoles).join(', ')}`);
    }

    // Get previous quota for logging
    const previousQuota = config.quotas.unitQuotas[unitRole] || config.quotas.defaultMinutes;

    // Update and persist the quota
    const success = setQuotaForUnit(unitRole, minutes, guildId);

    if (!success) {
      return interaction.editReply('❌ Failed to update quota. Please check the bot logs.');
    }

    const details = `Set quota for ${unitRole} from ${previousQuota} to ${minutes} minutes`;

    addAuditLog(
      guildId,
      interaction.user.id,
      interaction.user.username,
      'SET_QUOTA',
      null,
      details
    );

    await logAuditAction(interaction.client, guildId, interaction.user.username, 'SET_QUOTA', details);

    return interaction.editReply(
      `✅ Quota for **${unitRole}** has been set to **${minutes} minutes**.\n\n` +
      `Previous quota: ${previousQuota} minutes`
    );
  },
};
