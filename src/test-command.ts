import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from './commands/index';

export const testCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Тестовая команда'),

  async execute(interaction: CommandInteraction) {
    try {
      console.log('✅ Команда /test вызвана!');
      await interaction.reply({
        content: '✅ Бот работает!',
        ephemeral: true
      });
    } catch (error) {
      console.error('❌ Ошибка в /test:', error);
    }
  }
};