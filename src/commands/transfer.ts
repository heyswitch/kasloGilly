import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasSupervisorPermission } from '../config';
import { createDepartmentAction, addAuditLog, updateDepartmentActionMessageId } from '../database/database';
import { logDepartmentAction } from '../services/departmentLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Log a member transfer to a different unit/division')
    .addStringOption(option =>
      option.setName('username').setDescription('The Roblox username being transferred').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('to_unit').setDescription('The unit/division being transferred to').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('from_unit').setDescription('The unit/division being transferred from (optional)').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('notes').setDescription('Additional notes').setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.editReply('This command can only be used in a server.');
    }

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    if (!hasSupervisorPermission(memberRoleIds, guildId)) {
      return interaction.editReply('You do not have permission to use this command.');
    }

    const username = interaction.options.getString('username', true);
    const toUnit = interaction.options.getString('to_unit', true);
    const fromUnit = interaction.options.getString('from_unit');
    const notes = interaction.options.getString('notes');
    const targetUserId = `roblox_${username.toLowerCase()}`;

    // Create the transfer record
    const action = createDepartmentAction(guildId, {
      actionType: 'TRANSFER',
      targetUserId: targetUserId,
      targetUsername: username,
      adminUserId: interaction.user.id,
      adminUsername: interaction.user.username,
      notes: notes || undefined,
      previousUnit: fromUnit || undefined,
      newUnit: toUnit
    });

    // Log to channel
    const messageId = await logDepartmentAction(interaction.client, guildId, action);
    if (messageId) {
      updateDepartmentActionMessageId(guildId, action.id, messageId);
    }

    // Audit log
    const details = fromUnit
      ? `Transferred ${username} from ${fromUnit} to ${toUnit}`
      : `Transferred ${username} to ${toUnit}`;

    addAuditLog(
      guildId,
      interaction.user.id,
      interaction.user.username,
      'TRANSFER',
      targetUserId,
      details
    );

    return interaction.editReply(`Successfully logged transfer for **${username}** to **${toUnit}**.`);
  }
};
