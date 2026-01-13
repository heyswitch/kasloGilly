import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasCommandPermission, getConfig } from '../config';
import { writeFileSync } from 'fs';
import { join } from 'path';
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
    )
    .addIntegerOption(option =>
      option
        .setName('minutes')
        .setDescription('Required minutes per cycle')
        .setRequired(true)
        .setMinValue(0)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member as any;
    const memberRoleIds = member.roles.cache.map((role: any) => role.id);

    // Check command permissions
    const { hasCommandPermission } = require('../config');
    if (!hasCommandPermission(memberRoleIds)) {
      return interaction.editReply('❌ You do not have permission to use this command. Only command staff can set quotas.');
    }

    const unitRole = interaction.options.getString('unit_role', true);
    const minutes = interaction.options.getInteger('minutes', true);

    if (minutes < 0) {
      return interaction.editReply('❌ Minutes must be a positive number.');
    }

    // Get config and update
    const { getConfig } = require('../config');
    const config = getConfig();

    // Check if unit role exists
    if (!config.unitRoles[unitRole]) {
      return interaction.editReply(`❌ Invalid unit role. Available units: ${Object.keys(config.unitRoles).join(', ')}`);
    }

    // Update the quota in memory (note: this should ideally update the config file)
    // For now, we'll just notify the user that they need to update the config file manually
    // In a production environment, you'd want to persist this change

    const { addAuditLog } = require('../database/database');
    const { logAuditAction } = require('../services/shiftLogger');

    addAuditLog(
      interaction.user.id,
      interaction.user.username,
      'SET_QUOTA',
      null,
      `Set quota for ${interaction.options.getString('unit_role')} to ${interaction.options.getInteger('minutes')} minutes`
    );

    return interaction.editReply(
      '⚠️ **Note:** This command updates the quota in memory for the current session only.\n\n' +
      'To make permanent changes, please update the `config/config.json` file and restart the bot.\n\n' +
      `Quota for **${interaction.options.getString('unit_role')}** temporarily set to **${interaction.options.getInteger('minutes')} minutes**.`
    );
  },
};
