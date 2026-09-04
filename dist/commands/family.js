"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.familyInviteCommand = void 0;
exports.setFamilyDB = setFamilyDB;
exports.handleFamilyApply = handleFamilyApply;
exports.handleFamilyModal = handleFamilyModal;
exports.handleFamilyModeration = handleFamilyModeration;
exports.handleFamilyBirthdayModal = handleFamilyBirthdayModal;
exports.handleFamilyRejectModal = handleFamilyRejectModal;
const discord_js_1 = require("discord.js");
const logger_1 = require("../utils/logger");
let db = null;
let applicationCounter = 1;
// ID категории для заявок (нужно заменить на ваш)
const CATEGORY_ID = '1532673062510788779'; // <-- СЮДА ВСТАВИТЬ ID КАТЕГОРИИ
function setFamilyDB(database) {
    db = database;
    loadLastApplicationNumber();
}
async function loadLastApplicationNumber() {
    if (!db)
        return;
    try {
        const result = await db.get(`SELECT MAX(id) as max_id FROM family_applications`);
        if (result && result.max_id) {
            applicationCounter = result.max_id + 1;
        }
    }
    catch (error) {
        console.error('Ошибка загрузки номера заявки:', error);
    }
}
function isSendableChannel(channel) {
    if (!channel)
        return false;
    if (typeof channel.send !== 'function')
        return false;
    const sendableTypes = [
        discord_js_1.ChannelType.GuildText,
        discord_js_1.ChannelType.GuildAnnouncement,
        discord_js_1.ChannelType.PublicThread,
        discord_js_1.ChannelType.PrivateThread,
        discord_js_1.ChannelType.DM,
        discord_js_1.ChannelType.GroupDM
    ];
    return channel.type !== undefined && sendableTypes.includes(channel.type);
}
// Создание анкеты для заявки (Components V2)
async function buildApplicationForm(interaction) {
    const peachColor = 0xFFB07C;
    const container = new discord_js_1.ContainerBuilder()
        .setAccentColor(peachColor)
        .addMediaGalleryComponents(new discord_js_1.MediaGalleryBuilder()
        .addItems(new discord_js_1.MediaGalleryItemBuilder()
        .setURL('https://media.discordapp.net/attachments/1099441518479147150/1404943669299118119/f2db47d6e9f225b2.png?ex=6a6d1741&is=6a6bc5c1&hm=cd057d0ae25174fbdaf8c128650668df8b024b91918fd47658379b3deebf6f45&=&format=webp&quality=lossless&width=2100&height=1312')))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('👋 **Заявки в семью Washington\'s**'))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('🤝 **ТРЕБОВАНИЯ ВСТУПЛЕНИЯ В СЕМЬЮ** 🤝'))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('• Адекватность.'), new discord_js_1.TextDisplayBuilder().setContent('• Умение слушать старший состав семьи.'), new discord_js_1.TextDisplayBuilder().setContent('• Уважать всех однофамильцев.'), new discord_js_1.TextDisplayBuilder().setContent('• Воспринимать семью как отдельную фракцию.'), new discord_js_1.TextDisplayBuilder().setContent('• Смена фамилии.'), new discord_js_1.TextDisplayBuilder().setContent('• Идти за семьей в любую фракцию.'), new discord_js_1.TextDisplayBuilder().setContent('• Быть активным участником семьи.'), new discord_js_1.TextDisplayBuilder().setContent('• Веселиться со всеми!!!'))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('⚠️ **Предупреждение!**'), new discord_js_1.TextDisplayBuilder().setContent('Кто будет ради интереса создавать заявки, будет наказан.'))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small).setDivider(true));
    const row = new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('family_apply')
        .setLabel('📝 Подать заявку')
        .setStyle(discord_js_1.ButtonStyle.Primary));
    container.addActionRowComponents(row);
    return { container };
}
// Получение или создание голосовых каналов в категории
async function getOrCreateVoiceChannels(guild, categoryId) {
    const category = guild.channels.cache.get(categoryId);
    if (!category) {
        throw new Error('Категория не найдена! Укажите правильный ID категории в CATEGORY_ID');
    }
    let waitingChannel = guild.channels.cache.find((ch) => ch.parentId === categoryId && ch.name === 'Ожидание обзвона' && ch.type === discord_js_1.ChannelType.GuildVoice);
    let callChannel = guild.channels.cache.find((ch) => ch.parentId === categoryId && ch.name === 'Обзвон' && ch.type === discord_js_1.ChannelType.GuildVoice);
    if (!waitingChannel) {
        waitingChannel = await guild.channels.create({
            name: 'Ожидание обзвона',
            type: discord_js_1.ChannelType.GuildVoice,
            parent: categoryId,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [discord_js_1.PermissionFlagsBits.Connect],
                },
                {
                    id: guild.roles.everyone.id,
                    deny: [discord_js_1.PermissionFlagsBits.Connect],
                }
            ]
        });
        logger_1.logger.info('Создан голосовой канал "Ожидание обзвона"');
    }
    if (!callChannel) {
        callChannel = await guild.channels.create({
            name: 'Обзвон',
            type: discord_js_1.ChannelType.GuildVoice,
            parent: categoryId,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [discord_js_1.PermissionFlagsBits.Connect],
                },
                {
                    id: guild.roles.everyone.id,
                    deny: [discord_js_1.PermissionFlagsBits.Connect],
                }
            ]
        });
        logger_1.logger.info('Создан голосовой канал "Обзвон"');
    }
    return { waitingChannel, callChannel };
}
// Отправка заявки в канал (Components V2)
async function sendApplication(interaction, answers) {
    if (!db)
        throw new Error('Database not initialized');
    const applicationNumber = applicationCounter++;
    await db.run(`INSERT INTO family_applications (applicant_id, answers, status) VALUES (?, ?, ?)`, [interaction.user.id, JSON.stringify(answers), 'pending']);
    const guild = interaction.guild;
    if (!guild)
        throw new Error('Гильдия не найдена');
    let category = guild.channels.cache.get(CATEGORY_ID);
    if (!category) {
        category = await guild.channels.create({
            name: 'Заявки в семью',
            type: discord_js_1.ChannelType.GuildCategory,
        });
        logger_1.logger.info('Создана категория "Заявки в семью"');
    }
    const { waitingChannel, callChannel } = await getOrCreateVoiceChannels(guild, CATEGORY_ID);
    const channelName = `заявка-№${applicationNumber}`;
    const moderatorRole = guild.roles.cache.find(r => r.name === 'Модератор') ||
        guild.roles.cache.find(r => r.permissions.has(discord_js_1.PermissionFlagsBits.Administrator));
    const channel = await guild.channels.create({
        name: channelName,
        type: discord_js_1.ChannelType.GuildText,
        parent: CATEGORY_ID,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [discord_js_1.PermissionFlagsBits.ViewChannel],
            },
            {
                id: interaction.user.id,
                allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory],
            },
            ...(moderatorRole ? [{
                    id: moderatorRole.id,
                    allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory],
                }] : [])
        ]
    });
    // Создаем контейнер для заявки (Components V2)
    const peachColor = 0xFFB07C;
    const moderatorMention = moderatorRole ? `<@&${moderatorRole.id}>` : '@Модератор';
    const applicantMention = `<@${interaction.user.id}>`;
    const container = new discord_js_1.ContainerBuilder()
        .setAccentColor(peachColor)
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`📋 **Заявка №${applicationNumber}**`), new discord_js_1.TextDisplayBuilder().setContent(`👤 **${interaction.user.username}** подает заявку в семью!`), new discord_js_1.TextDisplayBuilder().setContent(`${applicantMention} ${moderatorMention}`))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`**❓ Почему хотите вступить?**\n${answers.question1 || 'Не указано'}`), new discord_js_1.TextDisplayBuilder().setContent(`**❓ Ваши навыки и умения?**\n${answers.question2 || 'Не указано'}`), new discord_js_1.TextDisplayBuilder().setContent(`**❓ Ваш опыт в других семьях?**\n${answers.question3 || 'Не указано'}`), new discord_js_1.TextDisplayBuilder().setContent(`**❓ Что вы можете дать семье?**\n${answers.question4 || 'Не указано'}`), new discord_js_1.TextDisplayBuilder().setContent(`**❓ Ваш возраст?**\n${answers.question5 || 'Не указано'}`))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`🆔 ID: ${interaction.user.id}`));
    // Кнопки модерации (Components V2)
    const row = new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`family_accept_${applicationNumber}`)
        .setLabel('✅ Принять')
        .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
        .setCustomId(`family_approve_${applicationNumber}`)
        .setLabel('📞 Позвать на обзвон')
        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
        .setCustomId(`family_reject_${applicationNumber}`)
        .setLabel('❌ Отказать')
        .setStyle(discord_js_1.ButtonStyle.Danger));
    container.addActionRowComponents(row);
    await channel.send({
        components: [container],
        flags: discord_js_1.MessageFlags.IsComponentsV2
    });
    await db.run(`UPDATE family_applications SET channel_id = ? WHERE id = ?`, [channel.id, applicationNumber]);
    return { channel, applicationNumber, waitingChannel, callChannel };
}
// ------ КОМАНДЫ ------
exports.familyInviteCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('familyinvite')
        .setDescription('[ADMIN] Создать меню для заявок в семью'),
    async execute(interaction) {
        try {
            if (!interaction.isChatInputCommand())
                return;
            if (!interaction.memberPermissions?.has('Administrator')) {
                await interaction.reply({ content: '❌ У вас нет прав администратора!', ephemeral: true });
                return;
            }
            if (!db) {
                await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
                return;
            }
            const channel = interaction.channel;
            if (!channel || !isSendableChannel(channel)) {
                await interaction.reply({ content: '❌ Эта команда работает только в текстовых каналах', ephemeral: true });
                return;
            }
            const { container } = await buildApplicationForm(interaction);
            await channel.send({
                components: [container],
                flags: discord_js_1.MessageFlags.IsComponentsV2
            });
            await interaction.reply({
                content: '✅ Меню заявок создано!',
                ephemeral: true
            });
        }
        catch (error) {
            console.error('Ошибка в familyInviteCommand:', error);
            await interaction.reply({ content: '❌ Ошибка при создании меню', ephemeral: true });
        }
    }
};
async function handleFamilyApply(interaction) {
    if (!interaction.isButton())
        return;
    if (interaction.customId !== 'family_apply')
        return;
    try {
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId('family_modal')
            .setTitle('📝 Заявка в семью');
        const question1 = new discord_js_1.TextInputBuilder()
            .setCustomId('q1')
            .setLabel('Почему хотите вступить?')
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setPlaceholder('Опишите свои мотивы...')
            .setRequired(true);
        const question2 = new discord_js_1.TextInputBuilder()
            .setCustomId('q2')
            .setLabel('Ваши навыки и умения?')
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setPlaceholder('Чем вы можете быть полезны?')
            .setRequired(true);
        const question3 = new discord_js_1.TextInputBuilder()
            .setCustomId('q3')
            .setLabel('Опыт в других семьях?')
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setPlaceholder('Были ли вы в других семьях?')
            .setRequired(false);
        const question4 = new discord_js_1.TextInputBuilder()
            .setCustomId('q4')
            .setLabel('Что вы можете дать семье?')
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setPlaceholder('Ваш вклад в развитие семьи...')
            .setRequired(true);
        const question5 = new discord_js_1.TextInputBuilder()
            .setCustomId('q5')
            .setLabel('Ваш возраст?')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setPlaceholder('Например: 20')
            .setRequired(true);
        const row1 = new discord_js_1.ActionRowBuilder().addComponents(question1);
        const row2 = new discord_js_1.ActionRowBuilder().addComponents(question2);
        const row3 = new discord_js_1.ActionRowBuilder().addComponents(question3);
        const row4 = new discord_js_1.ActionRowBuilder().addComponents(question4);
        const row5 = new discord_js_1.ActionRowBuilder().addComponents(question5);
        modal.addComponents(row1, row2, row3, row4, row5);
        await interaction.showModal(modal);
    }
    catch (error) {
        console.error('Ошибка в handleFamilyApply:', error);
        await interaction.reply({
            content: '❌ Произошла ошибка при открытии формы',
            ephemeral: true
        });
    }
}
async function handleFamilyModal(interaction) {
    if (!interaction.isModalSubmit())
        return;
    if (interaction.customId !== 'family_modal')
        return;
    try {
        await interaction.deferReply({ ephemeral: true });
        const answers = {
            question1: interaction.fields.getTextInputValue('q1'),
            question2: interaction.fields.getTextInputValue('q2'),
            question3: interaction.fields.getTextInputValue('q3') || 'Не указано',
            question4: interaction.fields.getTextInputValue('q4'),
            question5: interaction.fields.getTextInputValue('q5')
        };
        const { channel, applicationNumber, waitingChannel, callChannel } = await sendApplication(interaction, answers);
        await interaction.editReply({
            content: `✅ Ваша заявка №${applicationNumber} отправлена!\nКанал: ${channel.toString()}\n\n📞 После проверки вас позовут в голосовой канал **"Ожидание обзвона"**`
        });
    }
    catch (error) {
        console.error('Ошибка в handleFamilyModal:', error);
        await interaction.editReply({
            content: '❌ Произошла ошибка при отправке заявки'
        });
    }
}
// Обработка кнопок модерации
async function handleFamilyModeration(interaction) {
    if (!interaction.isButton())
        return;
    if (!interaction.customId.startsWith('family_'))
        return;
    if (interaction.customId === 'family_apply')
        return;
    try {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const applicationNumber = parseInt(parts[2]);
        if (isNaN(applicationNumber)) {
            await interaction.reply({ content: '❌ Неверный номер заявки', ephemeral: true });
            return;
        }
        if (!db) {
            await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
            return;
        }
        const application = await db.get(`SELECT * FROM family_applications WHERE id = ?`, [applicationNumber]);
        if (!application) {
            await interaction.reply({ content: '❌ Заявка не найдена', ephemeral: true });
            return;
        }
        const applicantId = application.applicant_id;
        const answers = JSON.parse(application.answers);
        // --- ПРИНЯТЬ ЗАЯВКУ ---
        if (action === 'accept') {
            // Открываем модальное окно для ввода дня рождения
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`family_birthday_modal_${applicationNumber}`)
                .setTitle(`🎂 День рождения`);
            const birthdayInput = new discord_js_1.TextInputBuilder()
                .setCustomId('birthday_date')
                .setLabel('Дата рождения (ДД/ММ)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('Например: 15/08')
                .setRequired(true)
                .setMinLength(5)
                .setMaxLength(5);
            const row = new discord_js_1.ActionRowBuilder().addComponents(birthdayInput);
            modal.addComponents(row);
            await interaction.showModal(modal);
            return;
        }
        // --- ПОЗВАТЬ НА ОБЗВОН ---
        if (action === 'approve') {
            try {
                const user = await interaction.client.users.fetch(applicantId);
                const guild = interaction.guild;
                if (!guild)
                    throw new Error('Гильдия не найдена');
                const waitingChannel = guild.channels.cache.find((ch) => ch.parentId === CATEGORY_ID && ch.name === 'Ожидание обзвона' && ch.type === discord_js_1.ChannelType.GuildVoice);
                if (!waitingChannel) {
                    await interaction.reply({
                        content: '❌ Голосовой канал "Ожидание обзвона" не найден!',
                        ephemeral: true
                    });
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('📞 Вас вызывают на обзвон!')
                    .setColor('#00FF88')
                    .setDescription(`**${interaction.user.username}** приглашает вас на обзвон по заявке №${applicationNumber}`)
                    .addFields({ name: '📍 Место', value: `Голосовой канал: **${waitingChannel.name}**` }, { name: '📝 Инструкция', value: 'Зайдите в голосовой канал и ожидайте модератора.' })
                    .setTimestamp();
                await user.send({ embeds: [embed] });
                const channel = interaction.channel;
                if (channel && isSendableChannel(channel)) {
                    const container = new discord_js_1.ContainerBuilder()
                        .setAccentColor(0x00FF88)
                        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`📞 **${interaction.user.username}** позвал(а) на обзвон <@${applicantId}>!`), new discord_js_1.TextDisplayBuilder().setContent(`📍 Голосовой канал: **${waitingChannel.name}**`));
                    await channel.send({
                        components: [container],
                        flags: discord_js_1.MessageFlags.IsComponentsV2
                    });
                }
                await interaction.reply({
                    content: `✅ Приглашение на обзвон отправлено!`,
                    ephemeral: true
                });
                await db.run(`UPDATE family_applications SET status = 'approved' WHERE id = ?`, [applicationNumber]);
            }
            catch (error) {
                console.error('Ошибка отправки приглашения:', error);
                await interaction.reply({
                    content: '❌ Не удалось отправить приглашение пользователю',
                    ephemeral: true
                });
            }
            return;
        }
        // --- ОТКАЗ С ФОРМОЙ ПРИЧИНЫ ---
        if (action === 'reject') {
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`family_reject_modal_${applicationNumber}`)
                .setTitle(`❌ Отказ по заявке №${applicationNumber}`);
            const reasonInput = new discord_js_1.TextInputBuilder()
                .setCustomId('reject_reason')
                .setLabel('Причина отказа')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setPlaceholder('Опишите причину отказа...')
                .setRequired(true);
            const row = new discord_js_1.ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(row);
            await interaction.showModal(modal);
        }
    }
    catch (error) {
        console.error('Ошибка в handleFamilyModeration:', error);
        await interaction.reply({
            content: '❌ Произошла ошибка при обработке заявки',
            ephemeral: true
        });
    }
}
// Обработка модального окна с днем рождения (при принятии)
async function handleFamilyBirthdayModal(interaction) {
    if (!interaction.isModalSubmit())
        return;
    if (!interaction.customId.startsWith('family_birthday_modal_'))
        return;
    try {
        const applicationNumber = parseInt(interaction.customId.replace('family_birthday_modal_', ''));
        if (!db) {
            await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
            return;
        }
        const application = await db.get(`SELECT * FROM family_applications WHERE id = ?`, [applicationNumber]);
        if (!application) {
            await interaction.reply({ content: '❌ Заявка не найдена', ephemeral: true });
            return;
        }
        const applicantId = application.applicant_id;
        const answers = JSON.parse(application.answers);
        const birthdayDate = interaction.fields.getTextInputValue('birthday_date');
        // Проверка формата ДД/ММ
        if (!/^\d{2}\/\d{2}$/.test(birthdayDate)) {
            await interaction.reply({
                content: '❌ Неверный формат! Используйте ДД/ММ (например: 15/08)',
                ephemeral: true
            });
            return;
        }
        const [day, month] = birthdayDate.split('/').map(Number);
        if (day < 1 || day > 31 || month < 1 || month > 12) {
            await interaction.reply({
                content: '❌ Неверная дата! День: 1-31, Месяц: 1-12',
                ephemeral: true
            });
            return;
        }
        // Сохраняем день рождения в таблицу birthdays
        await db.run(`INSERT INTO birthdays (user_id, birthday_date) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET birthday_date = ?, updated_at = CURRENT_TIMESTAMP`, [applicantId, birthdayDate, birthdayDate]);
        logger_1.logger.info(`День рождения ${birthdayDate} добавлен для пользователя ${applicantId}`);
        // Уведомляем пользователя
        try {
            const user = await interaction.client.users.fetch(applicantId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('✅ Заявка принята!')
                .setColor('#00FF88')
                .setDescription(`Ваша заявка №${applicationNumber} была **принята**!`)
                .addFields({ name: '🎉 Поздравляем!', value: 'Добро пожаловать в семью Washington\'s!' }, { name: '🎂 День рождения', value: birthdayDate, inline: true }, { name: '📅 Дата', value: new Date().toLocaleString() })
                .setTimestamp();
            await user.send({ embeds: [embed] });
        }
        catch (error) {
            console.error('Ошибка отправки уведомления:', error);
        }
        await interaction.reply({
            content: `✅ Заявка №${applicationNumber} принята! День рождения **${birthdayDate}** добавлен в календарь! 🎉`,
            ephemeral: true
        });
        await db.run(`UPDATE family_applications SET status = 'accepted' WHERE id = ?`, [applicationNumber]);
        // Обновляем сообщение в канале (Components V2)
        const channel = interaction.channel;
        if (channel && isSendableChannel(channel)) {
            const container = new discord_js_1.ContainerBuilder()
                .setAccentColor(0x00FF88)
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`✅ **Заявка №${applicationNumber} ПРИНЯТА**`), new discord_js_1.TextDisplayBuilder().setContent(`🎉 Поздравляем! Заявка одобрена.`), new discord_js_1.TextDisplayBuilder().setContent(`🎂 День рождения: **${birthdayDate}**`));
            await channel.send({
                components: [container],
                flags: discord_js_1.MessageFlags.IsComponentsV2
            });
        }
    }
    catch (error) {
        console.error('Ошибка в handleFamilyBirthdayModal:', error);
        await interaction.reply({
            content: '❌ Произошла ошибка при обработке дня рождения',
            ephemeral: true
        });
    }
}
// Обработка модального окна с причиной отказа
async function handleFamilyRejectModal(interaction) {
    if (!interaction.isModalSubmit())
        return;
    if (!interaction.customId.startsWith('family_reject_modal_'))
        return;
    try {
        const applicationNumber = parseInt(interaction.customId.replace('family_reject_modal_', ''));
        if (!db) {
            await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
            return;
        }
        const application = await db.get(`SELECT * FROM family_applications WHERE id = ?`, [applicationNumber]);
        if (!application) {
            await interaction.reply({ content: '❌ Заявка не найдена', ephemeral: true });
            return;
        }
        const applicantId = application.applicant_id;
        const reason = interaction.fields.getTextInputValue('reject_reason');
        const answers = JSON.parse(application.answers);
        try {
            const user = await interaction.client.users.fetch(applicantId);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('❌ Заявка отклонена')
                .setColor('#FF4444')
                .setDescription(`Ваша заявка №${applicationNumber} была отклонена.`)
                .addFields({ name: '📝 Причина отказа', value: reason || 'Не указана' }, { name: '📅 Дата', value: new Date().toLocaleString() })
                .setTimestamp();
            await user.send({ embeds: [embed] });
            await interaction.reply({
                content: `✅ Пользователю отправлено уведомление об отказе!`,
                ephemeral: true
            });
            await db.run(`UPDATE family_applications SET status = 'rejected' WHERE id = ?`, [applicationNumber]);
            const channel = interaction.channel;
            if (channel && isSendableChannel(channel)) {
                const container = new discord_js_1.ContainerBuilder()
                    .setAccentColor(0xFF4444)
                    .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`❌ **Заявка №${applicationNumber} ОТКЛОНЕНА**`), new discord_js_1.TextDisplayBuilder().setContent(`📝 Причина: ${reason || 'Не указана'}`));
                await channel.send({
                    components: [container],
                    flags: discord_js_1.MessageFlags.IsComponentsV2
                });
            }
        }
        catch (error) {
            console.error('Ошибка отправки отказа:', error);
            await interaction.reply({
                content: '❌ Не удалось отправить уведомление пользователю',
                ephemeral: true
            });
        }
    }
    catch (error) {
        console.error('Ошибка в handleFamilyRejectModal:', error);
        await interaction.reply({
            content: '❌ Произошла ошибка при отправке отказа',
            ephemeral: true
        });
    }
}
//# sourceMappingURL=family.js.map