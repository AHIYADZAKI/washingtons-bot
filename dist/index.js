"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
const discord_js_1 = require("discord.js");
const config_1 = require("./config");
const database_1 = require("./database");
const logger_1 = require("./utils/logger");
const commands_1 = require("./commands");
const birthday_1 = require("./commands/birthday");
const cars_1 = require("./commands/cars");
const family_1 = require("./commands/family");
const giveaway_1 = require("./commands/giveaway");
const report_1 = require("./commands/report");
const media_1 = require("./commands/media");
const antispam_1 = __importDefault(require("./modules/antispam"));
const stats_1 = __importDefault(require("./modules/stats"));
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildMembers,
        discord_js_1.GatewayIntentBits.GuildVoiceStates,
        discord_js_1.GatewayIntentBits.GuildPresences,
        discord_js_1.GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
        discord_js_1.Partials.Message,
        discord_js_1.Partials.Channel,
        discord_js_1.Partials.GuildMember,
        discord_js_1.Partials.User,
        discord_js_1.Partials.Reaction,
    ],
});
exports.client = client;
const adDataStore = new Map();
async function main() {
    try {
        const db = await (0, database_1.initializeDatabase)();
        stats_1.default.setDatabase(db);
        (0, commands_1.setBirthdayDB)(db);
        (0, commands_1.setCarsDB)(db);
        (0, commands_1.setFamilyDB)(db);
        (0, commands_1.setGiveawayDB)(db);
        (0, commands_1.setReportDB)(db);
        (0, commands_1.setMediaDB)(db);
        logger_1.logger.info('Database initialized');
        const commands = (0, commands_1.registerCommands)();
        client.once('ready', async () => {
            logger_1.logger.info(`✅ Бот запущен как ${client.user?.tag}`);
            try {
                await client.application?.commands.set(commands.map(cmd => cmd.data));
                logger_1.logger.info('✅ Команды зарегистрированы!');
                console.log('📋 Доступные команды:', commands.map(c => c.data.name).join(', '));
            }
            catch (error) {
                logger_1.logger.error('❌ Ошибка регистрации команд:', error);
            }
            // Запуск проверки неактивных пользователей каждые 24 часа
            setInterval(async () => {
                await stats_1.default.checkInactiveUsers(client.guilds.cache.first()?.id || '', config_1.config.family.roleId, config_1.config.family.inactiveRoleId);
            }, 24 * 60 * 60 * 1000);
            // Проверка дней рождения каждый день в 00:01
            setInterval(async () => {
                const now = new Date();
                if (now.getHours() === 0 && now.getMinutes() === 1) {
                    await (0, birthday_1.checkBirthdays)(client);
                }
            }, 60000);
            // Проверка розыгрышей каждую минуту
            setInterval(async () => {
                await (0, giveaway_1.checkGiveaways)(client);
            }, 60000);
            // Проверка медиа каждую минуту
            setInterval(async () => {
                await (0, media_1.checkMediaStatus)(client);
            }, 60000);
        });
        // Обработка сообщений с анти-спамом и статистикой
        client.on('messageCreate', async (message) => {
            if (message.author.bot)
                return;
            // Проверка на спам
            await antispam_1.default.handleSpam(message);
            // Статистика сообщений
            await stats_1.default.handleMessage(message);
        });
        // Обработка голосовых каналов
        client.on('voiceStateUpdate', async (oldState, newState) => {
            await stats_1.default.handleVoiceStateUpdate(oldState, newState);
        });
        client.on('interactionCreate', async (interaction) => {
            try {
                // Обработка команд
                if (interaction.isChatInputCommand()) {
                    console.log(`📩 Получена команда: ${interaction.commandName}`);
                    const command = commands.find(cmd => cmd.data.name === interaction.commandName);
                    if (command) {
                        await command.execute(interaction);
                    }
                }
                // Обработка кнопок
                if (interaction.isButton()) {
                    // Кнопки дней рождения
                    if (interaction.customId.startsWith('season_')) {
                        await (0, birthday_1.handleBirthdayButtons)(interaction);
                        return;
                    }
                    // Кнопки автомобилей
                    if (interaction.customId.startsWith('cars_')) {
                        await (0, cars_1.handleCarsButtons)(interaction);
                        return;
                    }
                    // Кнопка "Подать заявку" (семья)
                    if (interaction.customId === 'family_apply') {
                        await (0, family_1.handleFamilyApply)(interaction);
                        return;
                    }
                    // Кнопки модерации семьи (принять/обзвон/отказ)
                    if (interaction.customId.startsWith('family_accept_') ||
                        interaction.customId.startsWith('family_approve_') ||
                        interaction.customId.startsWith('family_reject_')) {
                        await (0, family_1.handleFamilyModeration)(interaction);
                        return;
                    }
                    // Кнопки тикетов
                    if (interaction.customId.startsWith('ticket_')) {
                        await (0, report_1.handleTicketButtons)(interaction);
                        return;
                    }
                    // Остальные кнопки (анкеты)
                    console.log(`🔘 Нажата кнопка: ${interaction.customId}`);
                    // Кнопка "Связаться"
                    if (interaction.customId.startsWith('contact_')) {
                        const adId = interaction.customId.replace('contact_', '');
                        console.log(`🔍 Поиск анкеты с ID: ${adId}`);
                        console.log(`📦 Хранилище содержит:`, Array.from(adDataStore.keys()));
                        const adData = adDataStore.get(adId);
                        if (adData) {
                            console.log(`✅ Найдена анкета автора: ${adData.authorId}`);
                            try {
                                const user = await client.users.fetch(adData.authorId);
                                const embedNotification = new discord_js_1.EmbedBuilder()
                                    .setTitle('📩 Новый запрос на связь!')
                                    .setColor('#FFB07C')
                                    .setDescription(`**${interaction.user.username}** хочет связаться с вами по поводу вашего объявления!`)
                                    .setThumbnail(interaction.user.displayAvatarURL({ size: 1024 }))
                                    .addFields({
                                    name: '📦 Товар/Услуга',
                                    value: adData.itemName,
                                    inline: false
                                }, {
                                    name: '💰 Цена',
                                    value: adData.price,
                                    inline: true
                                }, {
                                    name: '📝 Тип объявления',
                                    value: adData.type === 'покупку' ? '🛒 Покупка' : '💰 Продажа',
                                    inline: true
                                }, {
                                    name: '👤 Покупатель',
                                    value: interaction.user.toString(),
                                    inline: true
                                }, {
                                    name: '📞 Контакты продавца',
                                    value: adData.contact,
                                    inline: false
                                }, {
                                    name: '📝 Действие',
                                    value: `Напишите **${interaction.user.username}** для обсуждения деталей.`,
                                    inline: false
                                })
                                    .setTimestamp()
                                    .setFooter({
                                    text: `ID объявления: ${adId}`,
                                    iconURL: interaction.guild?.iconURL() || undefined
                                });
                                if (adData.imageUrl) {
                                    embedNotification.setImage(adData.imageUrl);
                                }
                                await user.send({
                                    embeds: [embedNotification]
                                }).catch(() => {
                                    console.log(`Не удалось отправить сообщение пользователю ${user.id}`);
                                });
                                await interaction.reply({
                                    content: `✅ Уведомление отправлено! Автор объявления свяжется с вами.`,
                                    ephemeral: true
                                });
                            }
                            catch (error) {
                                console.error('Ошибка при отправке уведомления:', error);
                                await interaction.reply({
                                    content: '❌ Не удалось найти автора объявления',
                                    ephemeral: true
                                });
                            }
                        }
                        else {
                            console.log(`❌ Анкета с ID ${adId} не найдена в хранилище`);
                            await interaction.reply({
                                content: '❌ Объявление не найдено или уже закрыто',
                                ephemeral: true
                            });
                        }
                    }
                    // Кнопка "Закрыть объявление"
                    if (interaction.customId.startsWith('close_')) {
                        const adId = interaction.customId.replace('close_', '');
                        console.log(`🔍 Поиск анкеты для закрытия с ID: ${adId}`);
                        const adData = adDataStore.get(adId);
                        if (adData && adData.authorId === interaction.user.id) {
                            const message = interaction.message;
                            const container = new discord_js_1.ContainerBuilder()
                                .setAccentColor(0xFFB07C)
                                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                                .setContent('🔒 **Объявление закрыто автором**'))
                                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                                .setContent('Данное объявление больше не актуально.'))
                                .addSeparatorComponents(new discord_js_1.SeparatorBuilder()
                                .setSpacing(discord_js_1.SeparatorSpacingSize.Small)
                                .setDivider(true))
                                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                                .setContent(`📦 Товар: ${adData.itemName}`))
                                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                                .setContent(`💰 Цена: ${adData.price}`));
                            await message.edit({
                                components: [container],
                                flags: discord_js_1.MessageFlags.IsComponentsV2
                            });
                            adDataStore.delete(adId);
                            console.log(`✅ Анкета ${adId} закрыта и удалена из хранилища`);
                            await interaction.reply({
                                content: '✅ Ваше объявление закрыто!',
                                ephemeral: true
                            });
                        }
                        else {
                            console.log(`❌ Не автор или анкета не найдена`);
                            await interaction.reply({
                                content: '❌ Вы не можете закрыть это объявление. Только автор может его закрыть.',
                                ephemeral: true
                            });
                        }
                    }
                    // Кнопка "Закрыть все"
                    if (interaction.customId === 'close_all_ads') {
                        let closedCount = 0;
                        const adsToClose = [];
                        for (const [adId, adData] of adDataStore) {
                            if (adData.authorId === interaction.user.id) {
                                adsToClose.push(adId);
                            }
                        }
                        console.log(`🔍 Найдено ${adsToClose.length} анкет для закрытия`);
                        for (const adId of adsToClose) {
                            const messages = await interaction.channel?.messages.fetch({ limit: 100 });
                            messages?.forEach(async (msg) => {
                                if (msg.components.length > 0) {
                                    const adData = adDataStore.get(adId);
                                    if (adData) {
                                        const container = new discord_js_1.ContainerBuilder()
                                            .setAccentColor(0xFFB07C)
                                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                                            .setContent('🔒 **Объявление закрыто автором**'))
                                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                                            .setContent('Данное объявление больше не актуально.'))
                                            .addSeparatorComponents(new discord_js_1.SeparatorBuilder()
                                            .setSpacing(discord_js_1.SeparatorSpacingSize.Small)
                                            .setDivider(true))
                                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                                            .setContent(`📦 Товар: ${adData.itemName}`))
                                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                                            .setContent(`💰 Цена: ${adData.price}`));
                                        await msg.edit({
                                            components: [container],
                                            flags: discord_js_1.MessageFlags.IsComponentsV2
                                        });
                                        closedCount++;
                                        adDataStore.delete(adId);
                                    }
                                }
                            });
                        }
                        await interaction.reply({
                            content: `✅ Закрыто анкет: **${closedCount}**`,
                            ephemeral: true
                        });
                    }
                    // Кнопка "Купить"
                    if (interaction.customId === 'buy_form') {
                        const modal = new discord_js_1.ModalBuilder()
                            .setCustomId('buy_modal')
                            .setTitle('📝 Анкета на покупку');
                        const nameInput = new discord_js_1.TextInputBuilder()
                            .setCustomId('item_name')
                            .setLabel('Что хотите купить?')
                            .setStyle(discord_js_1.TextInputStyle.Short)
                            .setPlaceholder('Например: Apple iPhone 15')
                            .setRequired(true);
                        const priceInput = new discord_js_1.TextInputBuilder()
                            .setCustomId('item_price')
                            .setLabel('Цена (в рублях)')
                            .setStyle(discord_js_1.TextInputStyle.Short)
                            .setPlaceholder('Например: 50000')
                            .setRequired(true);
                        const descInput = new discord_js_1.TextInputBuilder()
                            .setCustomId('item_description')
                            .setLabel('Описание')
                            .setStyle(discord_js_1.TextInputStyle.Paragraph)
                            .setPlaceholder('Опишите подробнее что хотите купить...')
                            .setRequired(false);
                        const imageInput = new discord_js_1.TextInputBuilder()
                            .setCustomId('item_image')
                            .setLabel('Ссылка на фото (необязательно)')
                            .setStyle(discord_js_1.TextInputStyle.Short)
                            .setPlaceholder('https://example.com/image.jpg')
                            .setRequired(false);
                        const contactInput = new discord_js_1.TextInputBuilder()
                            .setCustomId('contact_info')
                            .setLabel('Контактная информация')
                            .setStyle(discord_js_1.TextInputStyle.Short)
                            .setPlaceholder('Discord: @username или Telegram: @username')
                            .setRequired(true);
                        const row1 = new discord_js_1.ActionRowBuilder().addComponents(nameInput);
                        const row2 = new discord_js_1.ActionRowBuilder().addComponents(priceInput);
                        const row3 = new discord_js_1.ActionRowBuilder().addComponents(descInput);
                        const row4 = new discord_js_1.ActionRowBuilder().addComponents(imageInput);
                        const row5 = new discord_js_1.ActionRowBuilder().addComponents(contactInput);
                        modal.addComponents(row1, row2, row3, row4, row5);
                        await interaction.showModal(modal);
                        console.log('✅ Модальное окно покупки открыто');
                    }
                    // Кнопка "Продать"
                    if (interaction.customId === 'sell_form') {
                        const modal = new discord_js_1.ModalBuilder()
                            .setCustomId('sell_modal')
                            .setTitle('📝 Анкета на продажу');
                        const nameInput = new discord_js_1.TextInputBuilder()
                            .setCustomId('item_name')
                            .setLabel('Что продаете?')
                            .setStyle(discord_js_1.TextInputStyle.Short)
                            .setPlaceholder('Например: Apple iPhone 15')
                            .setRequired(true);
                        const priceInput = new discord_js_1.TextInputBuilder()
                            .setCustomId('item_price')
                            .setLabel('Цена (в рублях)')
                            .setStyle(discord_js_1.TextInputStyle.Short)
                            .setPlaceholder('Например: 50000')
                            .setRequired(true);
                        const descInput = new discord_js_1.TextInputBuilder()
                            .setCustomId('item_description')
                            .setLabel('Описание')
                            .setStyle(discord_js_1.TextInputStyle.Paragraph)
                            .setPlaceholder('Опишите подробнее товар...')
                            .setRequired(false);
                        const imageInput = new discord_js_1.TextInputBuilder()
                            .setCustomId('item_image')
                            .setLabel('Ссылка на фото (необязательно)')
                            .setStyle(discord_js_1.TextInputStyle.Short)
                            .setPlaceholder('https://example.com/image.jpg')
                            .setRequired(false);
                        const contactInput = new discord_js_1.TextInputBuilder()
                            .setCustomId('contact_info')
                            .setLabel('Контактная информация')
                            .setStyle(discord_js_1.TextInputStyle.Short)
                            .setPlaceholder('Discord: @username или Telegram: @username')
                            .setRequired(true);
                        const row1 = new discord_js_1.ActionRowBuilder().addComponents(nameInput);
                        const row2 = new discord_js_1.ActionRowBuilder().addComponents(priceInput);
                        const row3 = new discord_js_1.ActionRowBuilder().addComponents(descInput);
                        const row4 = new discord_js_1.ActionRowBuilder().addComponents(imageInput);
                        const row5 = new discord_js_1.ActionRowBuilder().addComponents(contactInput);
                        modal.addComponents(row1, row2, row3, row4, row5);
                        await interaction.showModal(modal);
                        console.log('✅ Модальное окно продажи открыто');
                    }
                }
                // Обработка селект-меню автомобилей
                if (interaction.isStringSelectMenu() && interaction.customId === 'cars_select') {
                    await (0, cars_1.handleCarsSelect)(interaction);
                    return;
                }
                // Обработка модальных окон
                if (interaction.isModalSubmit()) {
                    // Модальное окно заявки в семью
                    if (interaction.customId === 'family_modal') {
                        await (0, family_1.handleFamilyModal)(interaction);
                        return;
                    }
                    // Модальное окно с днем рождения (при принятии заявки)
                    if (interaction.customId.startsWith('family_birthday_modal_')) {
                        await (0, family_1.handleFamilyBirthdayModal)(interaction);
                        return;
                    }
                    // Модальное окно отказа по заявке в семью
                    if (interaction.customId.startsWith('family_reject_modal_')) {
                        await (0, family_1.handleFamilyRejectModal)(interaction);
                        return;
                    }
                    // Модальное окно создания тикета
                    if (interaction.customId === 'ticket_modal') {
                        await (0, report_1.handleTicketModal)(interaction);
                        return;
                    }
                    // Модальные окна анкет (покупка/продажа)
                    console.log(`📝 Отправлена форма: ${interaction.customId}`);
                    try {
                        const itemName = interaction.fields.getTextInputValue('item_name');
                        const price = interaction.fields.getTextInputValue('item_price');
                        const description = interaction.fields.getTextInputValue('item_description') || 'Без описания';
                        const imageUrl = interaction.fields.getTextInputValue('item_image') || '';
                        const contact = interaction.fields.getTextInputValue('contact_info');
                        const type = interaction.customId === 'buy_modal' ? 'покупку' : 'продажу';
                        const emoji = interaction.customId === 'buy_modal' ? '🛒' : '💰';
                        const color = interaction.customId === 'buy_modal' ? '#FFB07C' : '#FF8C69';
                        const adId = Date.now().toString(36).toUpperCase();
                        console.log(`📝 Создана анкета с ID: ${adId}`);
                        // Сохраняем все данные об объявлении
                        adDataStore.set(adId, {
                            authorId: interaction.user.id,
                            itemName: itemName,
                            price: `${price} ₽`,
                            description: description,
                            contact: contact,
                            type: type,
                            imageUrl: imageUrl || undefined
                        });
                        console.log(`✅ Анкета ${adId} сохранена в хранилище`);
                        console.log(`📦 Все ID в хранилище:`, Array.from(adDataStore.keys()));
                        // Создаем контейнер
                        const container = new discord_js_1.ContainerBuilder()
                            .setAccentColor(parseInt(color.replace('#', ''), 16))
                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                            .setContent(`${emoji} **Анкета на ${type}**`))
                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                            .setContent(`**${interaction.user.username}** подал(а) заявку на ${type}`))
                            .addSeparatorComponents(new discord_js_1.SeparatorBuilder()
                            .setSpacing(discord_js_1.SeparatorSpacingSize.Small)
                            .setDivider(true));
                        // Если есть фото, добавляем галерею
                        if (imageUrl) {
                            try {
                                new URL(imageUrl);
                                const mediaGallery = new discord_js_1.MediaGalleryBuilder()
                                    .addItems(new discord_js_1.MediaGalleryItemBuilder()
                                    .setURL(imageUrl));
                                container.addMediaGalleryComponents(mediaGallery);
                            }
                            catch (error) {
                                console.log('❌ Невалидная ссылка на фото:', imageUrl);
                            }
                        }
                        // Добавляем остальную информацию
                        container
                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                            .setContent(`**📦 Товар/Услуга**\n${itemName}`))
                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                            .setContent(`**💰 Цена**\n${price} ₽`))
                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                            .setContent(`**👤 Заявитель**\n${interaction.user.toString()}`))
                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                            .setContent(`**📝 Подробное описание**\n${description}`))
                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                            .setContent(`**📞 Контакты для связи**\n${contact}`))
                            .addSeparatorComponents(new discord_js_1.SeparatorBuilder()
                            .setSpacing(discord_js_1.SeparatorSpacingSize.Small)
                            .setDivider(true))
                            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                            .setContent(`🆔 ID: \`${adId}\``))
                            .addActionRowComponents(new discord_js_1.ActionRowBuilder()
                            .addComponents(new discord_js_1.ButtonBuilder()
                            .setCustomId(`contact_${adId}`)
                            .setLabel('📩 Связаться')
                            .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                            .setCustomId(`close_${adId}`)
                            .setLabel('🔒 Закрыть объявление')
                            .setStyle(discord_js_1.ButtonStyle.Danger)));
                        const channel = interaction.channel;
                        if (channel && channel.isTextBased() && !channel.isDMBased()) {
                            await channel.send({
                                components: [container],
                                flags: discord_js_1.MessageFlags.IsComponentsV2
                            });
                            console.log('✅ Анкета с фото отправлена в канал');
                        }
                        await interaction.reply({
                            content: `✅ **Ваша анкета на ${type} успешно создана!**\n\nID анкеты: \`${adId}\``,
                            ephemeral: true
                        });
                    }
                    catch (error) {
                        console.error('❌ Ошибка при обработке формы:', error);
                        await interaction.reply({
                            content: '❌ Произошла ошибка при создании анкеты. Попробуйте позже.',
                            ephemeral: true
                        });
                    }
                }
            }
            catch (error) {
                console.error('❌ Ошибка в interactionCreate:', error);
                if (interaction.isRepliable()) {
                    await interaction.reply({
                        content: '❌ Произошла ошибка при выполнении действия',
                        ephemeral: true
                    }).catch(() => { });
                }
            }
        });
        await client.login(config_1.config.token);
        logger_1.logger.info('✅ Бот залогинился');
    }
    catch (error) {
        logger_1.logger.error('❌ Ошибка запуска:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map