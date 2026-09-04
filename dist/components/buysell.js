"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBuySellButtons = handleBuySellButtons;
exports.handleModalSubmit = handleModalSubmit;
const discord_js_1 = require("discord.js");
async function handleBuySellButtons(interaction) {
    const customId = interaction.customId;
    if (customId === 'buy_form') {
        await handleBuyForm(interaction);
    }
    else if (customId === 'sell_form') {
        await handleSellForm(interaction);
    }
}
async function handleBuyForm(interaction) {
    // Создаем модальное окно
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId('buy_modal')
        .setTitle('📝 Анкета на покупку');
    // Поля для анкеты
    const nameInput = new discord_js_1.TextInputBuilder()
        .setCustomId('item_name')
        .setLabel('Что хотите купить?')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Напишите название товара')
        .setRequired(true);
    const priceInput = new discord_js_1.TextInputBuilder()
        .setCustomId('item_price')
        .setLabel('Цена (в рублях)')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Например: 1000')
        .setRequired(true);
    const descInput = new discord_js_1.TextInputBuilder()
        .setCustomId('item_description')
        .setLabel('Описание')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setPlaceholder('Опишите подробнее что хотите купить...')
        .setRequired(false);
    const contactInput = new discord_js_1.TextInputBuilder()
        .setCustomId('contact_info')
        .setLabel('Контактная информация')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Discord: @username или Telegram: @username')
        .setRequired(true);
    // Добавляем поля в модальное окно
    const row1 = new discord_js_1.ActionRowBuilder().addComponents(nameInput);
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(priceInput);
    const row3 = new discord_js_1.ActionRowBuilder().addComponents(descInput);
    const row4 = new discord_js_1.ActionRowBuilder().addComponents(contactInput);
    modal.addComponents(row1, row2, row3, row4);
    await interaction.showModal(modal);
}
async function handleSellForm(interaction) {
    // Создаем модальное окно
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId('sell_modal')
        .setTitle('📝 Анкета на продажу');
    // Поля для анкеты
    const nameInput = new discord_js_1.TextInputBuilder()
        .setCustomId('item_name')
        .setLabel('Что продаете?')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Напишите название товара')
        .setRequired(true);
    const priceInput = new discord_js_1.TextInputBuilder()
        .setCustomId('item_price')
        .setLabel('Цена (в рублях)')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Например: 1000')
        .setRequired(true);
    const descInput = new discord_js_1.TextInputBuilder()
        .setCustomId('item_description')
        .setLabel('Описание')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setPlaceholder('Опишите подробнее товар...')
        .setRequired(false);
    const contactInput = new discord_js_1.TextInputBuilder()
        .setCustomId('contact_info')
        .setLabel('Контактная информация')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Discord: @username или Telegram: @username')
        .setRequired(true);
    // Добавляем поля в модальное окно
    const row1 = new discord_js_1.ActionRowBuilder().addComponents(nameInput);
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(priceInput);
    const row3 = new discord_js_1.ActionRowBuilder().addComponents(descInput);
    const row4 = new discord_js_1.ActionRowBuilder().addComponents(contactInput);
    modal.addComponents(row1, row2, row3, row4);
    await interaction.showModal(modal);
}
// Обработка отправки модальных форм
async function handleModalSubmit(interaction) {
    if (!interaction.isModalSubmit())
        return;
    const customId = interaction.customId;
    if (customId === 'buy_modal' || customId === 'sell_modal') {
        const type = customId === 'buy_modal' ? 'покупку' : 'продажу';
        const itemName = interaction.fields.getTextInputValue('item_name');
        const price = interaction.fields.getTextInputValue('item_price');
        const description = interaction.fields.getTextInputValue('item_description') || 'Без описания';
        const contact = interaction.fields.getTextInputValue('contact_info');
        // Создаем embed с анкетой
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`📋 Анкета на ${type}`)
            .setColor(customId === 'buy_modal' ? '#00ff88' : '#ff8800')
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields({ name: '👤 Подал заявку', value: interaction.user.toString(), inline: true }, { name: '📦 Товар', value: itemName, inline: true }, { name: '💰 Цена', value: `${price} ₽`, inline: true }, { name: '📝 Описание', value: description }, { name: '📞 Контакты', value: contact })
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
//# sourceMappingURL=buysell.js.map