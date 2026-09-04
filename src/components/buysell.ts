import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';

export async function handleBuySellButtons(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (customId === 'buy_form') {
    await handleBuyForm(interaction);
  } else if (customId === 'sell_form') {
    await handleSellForm(interaction);
  }
}

async function handleBuyForm(interaction: ButtonInteraction) {
  // Создаем модальное окно
  const modal = new ModalBuilder()
    .setCustomId('buy_modal')
    .setTitle('📝 Анкета на покупку');

  // Поля для анкеты
  const nameInput = new TextInputBuilder()
    .setCustomId('item_name')
    .setLabel('Что хотите купить?')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Напишите название товара')
    .setRequired(true);

  const priceInput = new TextInputBuilder()
    .setCustomId('item_price')
    .setLabel('Цена (в рублях)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Например: 1000')
    .setRequired(true);

  const descInput = new TextInputBuilder()
    .setCustomId('item_description')
    .setLabel('Описание')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Опишите подробнее что хотите купить...')
    .setRequired(false);

  const contactInput = new TextInputBuilder()
    .setCustomId('contact_info')
    .setLabel('Контактная информация')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Discord: @username или Telegram: @username')
    .setRequired(true);

  // Добавляем поля в модальное окно
  const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
  const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput);
  const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(descInput);
  const row4 = new ActionRowBuilder<TextInputBuilder>().addComponents(contactInput);

  modal.addComponents(row1, row2, row3, row4);

  await interaction.showModal(modal);
}

async function handleSellForm(interaction: ButtonInteraction) {
  // Создаем модальное окно
  const modal = new ModalBuilder()
    .setCustomId('sell_modal')
    .setTitle('📝 Анкета на продажу');

  // Поля для анкеты
  const nameInput = new TextInputBuilder()
    .setCustomId('item_name')
    .setLabel('Что продаете?')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Напишите название товара')
    .setRequired(true);

  const priceInput = new TextInputBuilder()
    .setCustomId('item_price')
    .setLabel('Цена (в рублях)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Например: 1000')
    .setRequired(true);

  const descInput = new TextInputBuilder()
    .setCustomId('item_description')
    .setLabel('Описание')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Опишите подробнее товар...')
    .setRequired(false);

  const contactInput = new TextInputBuilder()
    .setCustomId('contact_info')
    .setLabel('Контактная информация')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Discord: @username или Telegram: @username')
    .setRequired(true);

  // Добавляем поля в модальное окно
  const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
  const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput);
  const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(descInput);
  const row4 = new ActionRowBuilder<TextInputBuilder>().addComponents(contactInput);

  modal.addComponents(row1, row2, row3, row4);

  await interaction.showModal(modal);
}

// Обработка отправки модальных форм
export async function handleModalSubmit(interaction: any) {
  if (!interaction.isModalSubmit()) return;

  const customId = interaction.customId;

  if (customId === 'buy_modal' || customId === 'sell_modal') {
    const type = customId === 'buy_modal' ? 'покупку' : 'продажу';
    const itemName = interaction.fields.getTextInputValue('item_name');
    const price = interaction.fields.getTextInputValue('item_price');
    const description = interaction.fields.getTextInputValue('item_description') || 'Без описания';
    const contact = interaction.fields.getTextInputValue('contact_info');

    // Создаем embed с анкетой
    const embed = new EmbedBuilder()
      .setTitle(`📋 Анкета на ${type}`)
      .setColor(customId === 'buy_modal' ? '#00ff88' : '#ff8800')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Подал заявку', value: interaction.user.toString(), inline: true },
        { name: '📦 Товар', value: itemName, inline: true },
        { name: '💰 Цена', value: `${price} ₽`, inline: true },
        { name: '📝 Описание', value: description },
        { name: '📞 Контакты', value: contact }
      )
      .setTimestamp()
      .setFooter({ text: `ID: ${interaction.user.id}` });

    // Отправляем в канал (можно настроить конкретный канал)
    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      await channel.send({
        embeds: [embed],
        content: `📢 Новая анкета на ${type}!`
      });
    }

    await interaction.reply({
      content: `✅ Ваша анкета на ${type} успешно создана!`,
      ephemeral: true
    });
  }
}