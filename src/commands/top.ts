import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from './index';
import statsModule from '../modules/stats';

export const topCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('топ')
    .setDescription('Показать топ-10 пользователей')
    .addStringOption((option: any) =>
      option
        .setName('тип')
        .setDescription('Тип топа')
        .setRequired(true)
        .addChoices(
          { name: '📝 По сообщениям', value: 'messages' },
          { name: '🎤 По голосовому времени', value: 'voice' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;

      const type = interaction.options.getString('тип', true) as 'messages' | 'voice';
      
      const embed = await statsModule.createTopEmbed(type);
      
      if (!embed) {
        await interaction.reply({
          content: '❌ Нет данных для отображения',
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        embeds: [embed]
      });
    } catch (error) {
      console.error('❌ Ошибка в /топ:', error);
      await interaction.reply({
        content: '❌ Произошла ошибка при получении топа',
        ephemeral: true
      });
    }
  }
};