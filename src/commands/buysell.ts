import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  ContainerBuilder, 
  TextDisplayBuilder, 
  SeparatorBuilder, 
  SeparatorSpacingSize,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { Command } from './index';

export const buysellCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('buysell')
    .setDescription('Создать меню для покупки/продажи'),

  async execute(interaction: CommandInteraction) {
    try {
      console.log('✅ Команда /buysell вызвана');
      
      const peachColor = 0xFFB07C;

      const container = new ContainerBuilder()
        .setAccentColor(peachColor)
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('🍑 **Добро пожаловать в торговую площадку!**')
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('✨ *Здесь вы можете создать анкету для покупки или продажи товаров и услуг.*')
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('🛒 **Создать анкету на покупку**')
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('📌 *Опишите что вы хотите приобрести, укажите бюджет и контактные данные для связи*')
        )
        .addActionRowComponents(
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('buy_form')
                .setLabel('🛒 Купить')
                .setStyle(ButtonStyle.Success)
            )
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('💰 **Создать анкету на продажу**')
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('📌 *Опишите что вы продаете, укажите цену и контактные данные для связи*')
        )
        .addActionRowComponents(
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('sell_form')
                .setLabel('💰 Продать')
                .setStyle(ButtonStyle.Primary)
            )
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('📋 **Правила оформления анкет:**')
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('• Заполняйте все поля максимально подробно\n• Указывайте реальную цену и контакты\n• Будьте вежливы и адекватны\n• Администрация оставляет за собой право удалять анкеты')
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('💫 *С уважением, Администрация торговой площадки\n Если хотите добавить бота к себе, для меж серверной торговли,\n свяжитесь с **ahiyadzaki** *')
        );

      await interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
      
      console.log('✅ Красивое меню Components V2 отправлено');
    } catch (error) {
      console.error('❌ Ошибка в /buysell:', error);
      await interaction.reply({
        content: '❌ Произошла ошибка при создании меню',
        ephemeral: true
      });
    }
  }
};