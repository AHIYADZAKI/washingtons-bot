import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, APIEmbedField } from 'discord.js';
import { Command } from './index';

export const myAdsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('моианкеты')
    .setDescription('Управление вашими анкетами'),

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;
      
      const messages = await interaction.channel?.messages.fetch({ limit: 100 });
      const userAds: any[] = [];
      
      messages?.forEach(msg => {
        if (msg.embeds.length > 0 && msg.components.length > 0) {
          const embed = msg.embeds[0];
          const authorField = embed.fields?.find((f: APIEmbedField) => f.name === '👤 Заявитель');
          
          if (authorField) {
            const userId = authorField.value.match(/<@!?(\d+)>/)?.[1];
            if (userId === interaction.user.id) {
              userAds.push({
                message: msg,
                embed: embed,
                id: embed.footer?.text?.replace('ID: ', '') || 'unknown'
              });
            }
          }
        }
      });
      
      if (userAds.length === 0) {
        await interaction.reply({
          content: '📭 У вас нет активных анкет',
          ephemeral: true
        });
        return;
      }
      
      const embed = new EmbedBuilder()
        .setTitle('📋 Ваши активные анкеты')
        .setColor('#FFB07C')
        .setDescription(`Найдено анкет: **${userAds.length}**`)
        .setTimestamp();
      
      userAds.forEach((ad, index) => {
        const title = ad.embed.title || 'Анкета';
        const itemField = ad.embed.fields?.find((f: APIEmbedField) => f.name === '📦 Товар/Услуга');
        const itemName = itemField?.value || 'Не указано';
        
        embed.addFields({
          name: `${index + 1}. ${title}`,
          value: `📦 ${itemName}\n🆔 ID: \`${ad.id}\``,
          inline: false
        });
      });
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('close_all_ads')
            .setLabel('🔒 Закрыть все')
            .setStyle(ButtonStyle.Danger)
        );
      
      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('❌ Ошибка в /моианкеты:', error);
      await interaction.reply({
        content: '❌ Произошла ошибка при получении анкет',
        ephemeral: true
      });
    }
  }
};