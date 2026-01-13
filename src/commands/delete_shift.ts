import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { hasSupervisorPermission } from '../config';
import { deleteShiftByCode, getShiftByCode, addAuditLog } from '../database/database';
import { logAuditAction } from '../services/shiftLogger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete_shift')
    .setDescription('Delete a shift record (Supervisor role only)')
    .addStringOption(option =>
      option
        .setName('shift_code')
        .setDescription('The shift code to delete (e.g., ABC12345)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for deleting the shift')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member as GuildMember;
    const memberRoleIds = member.roles.cache.map(role => role.id);

    // Check supervisor permissions
    if (!hasSupervisorPermission(memberRoleIds)) {
      return interaction.editReply('❌ You do not have permission to use this command. Only supervisors can delete shifts.');
    }

    const shiftCode = interaction.options.getString('shift_code', true).toUpperCase();
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Verify shift exists
    const shift = getShiftByCode(shiftCode);
    if (!shift) {
      return interaction.editReply(`❌ No shift found with code **${shiftCode}**. Please check the shift code and try again.`);
    }

    // Create confirmation buttons
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_delete')
      .setLabel('Yes, Delete')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_delete')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    const response = await interaction.editReply({
      content: `⚠️ Are you sure you want to delete shift **${shiftCode}**?\n\n**User:** ${shift.username}\n**Reason:** ${reason}\n\nThis action cannot be undone.`,
      components: [row]
    });

    // Wait for button click
    try {
      const confirmation = await response.awaitMessageComponent({
        filter: i => i.user.id === interaction.user.id,
        componentType: ComponentType.Button,
        time: 30000
      });

      if (confirmation.customId === 'cancel_delete') {
        await confirmation.update({ content: '❌ Deletion cancelled.', components: [] });
        return;
      }

      // Delete shift
      const success = deleteShiftByCode(shiftCode);

      if (!success) {
        await confirmation.update({
          content: '❌ Failed to delete shift. Please try again.',
          components: []
        });
        return;
      }

      // Log audit
      const details = `Deleted shift ${shiftCode} (User: ${shift.username}) - Reason: ${reason}`;
      addAuditLog(
        interaction.user.id,
        interaction.user.username,
        'DELETE_SHIFT',
        shift.userId,
        details
      );

      await logAuditAction(interaction.client, interaction.user.username, 'DELETE_SHIFT', details);

      await confirmation.update({
        content: `✅ Successfully deleted shift **${shiftCode}**.\n\n**User:** ${shift.username}\n**Reason:** ${reason}`,
        components: []
      });
    } catch (error) {
      await interaction.editReply({
        content: '❌ Confirmation timed out. Deletion cancelled.',
        components: []
      });
    }
  },
};
