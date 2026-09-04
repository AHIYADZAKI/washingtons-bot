import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from './index';
import statsModule from '../modules/stats';

export const statsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('статистика')
    .setDescription('Показать вашу статистику')
    .addUserOption((option: any) =>
      option
        .setName('пользователь')
        .setDescription('Пользователь, чью статистику показать')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;

      const targetUser = interaction.options.getUser('пользователь') || interaction.user;
      
      const embed = await statsModule.createStatsEmbed(targetUser.id);
      
      if (!embed) {
        await interaction.reply({
          content: '❌ Статистика для этого пользователя не найдена',
          ephemeral: true
        });
        return;
      }

      embed.setAuthor({
        name: targetUser.username,
        iconURL: targetUser.displayAvatarURL()
      });

      await interaction.reply({
        embeds: [embed]
      });
    } catch (error) {
      console.error('❌ Ошибка в /статистика:', error);
      await interaction.reply({
        content: '❌ Произошла ошибка при получении статистики',
        ephemeral: true
      });
    }
  }
};