"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.carsMenuCommand = exports.carDeleteCommand = exports.carAddCommand = void 0;
exports.setCarsDB = setCarsDB;
exports.handleCarsButtons = handleCarsButtons;
exports.handleCarsSelect = handleCarsSelect;
const discord_js_1 = require("discord.js");
const logger_1 = require("../utils/logger");
let db = null;
const RENTAL_DURATION = 45; // минут
function setCarsDB(database) {
    db = database;
}
// Получение отображаемого имени пользователя
async function getUserDisplayName(interaction, userId) {
    try {
        const guild = interaction.guild;
        if (!guild)
            return 'Неизвестный';
        const member = await guild.members.fetch(userId).catch(() => undefined);
        if (!member)
            return 'Неизвестный';
        return member.nickname || member.user.displayName || member.user.username;
    }
    catch {
        return 'Неизвестный';
    }
}
// Построение главного меню автомобилей (Components V2)
async function buildCarsMenu(interaction) {
    if (!db)
        throw new Error('Database not initialized');
    const cars = await db.all(`SELECT * FROM family_cars ORDER BY name`);
    const peachColor = 0xFFB07C;
    const now = new Date();
    const occupiedCars = cars.filter((c) => c.is_occupied === 1);
    const freeCars = cars.filter((c) => c.is_occupied === 0);
    const container = new discord_js_1.ContainerBuilder()
        .setAccentColor(peachColor)
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('🚗 **Отчеты на автомобили**'))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('🚦 **Занятые автомобили:**'));
    if (occupiedCars.length === 0) {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('📭 *Нет занятых автомобилей*'));
    }
    else {
        for (const car of occupiedCars) {
            const user = await interaction.client.users.fetch(car.occupied_by).catch(() => null);
            const username = user ? await getUserDisplayName(interaction, car.occupied_by) : 'Неизвестный';
            const occupiedAt = new Date(car.occupied_at);
            const minutesPassed = Math.floor((now.getTime() - occupiedAt.getTime()) / 60000);
            const minutesLeft = Math.max(0, RENTAL_DURATION - minutesPassed);
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`❌ **${car.name}** — ${username} (осталось ${minutesLeft} мин)`));
        }
    }
    container
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('🟢 **Свободные автомобили:**'));
    if (freeCars.length === 0) {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('📭 *Нет свободных автомобилей*'));
    }
    else {
        for (const car of freeCars) {
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`✅ **${car.name}** — свободен`));
        }
    }
    container
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`📊 Всего автомобилей: ${cars.length} (Занято: ${occupiedCars.length})`));
    const row = new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('cars_list')
        .setLabel('📋 Список автомобилей')
        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
        .setCustomId('cars_release')
        .setLabel('🔓 Освободить текущий')
        .setStyle(discord_js_1.ButtonStyle.Success));
    container.addActionRowComponents(row);
    return { container };
}
// Построение списка автомобилей с селект-меню (Components V2)
async function buildCarsList(interaction) {
    if (!db)
        throw new Error('Database not initialized');
    const cars = await db.all(`SELECT * FROM family_cars ORDER BY name`);
    const peachColor = 0xFFB07C;
    const container = new discord_js_1.ContainerBuilder()
        .setAccentColor(peachColor)
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('🚗 **Отчеты на автомобили**'))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Выберите желаемый автомобиль из списка ниже!'))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small).setDivider(true));
    for (const car of cars) {
        const status = car.is_occupied === 1 ? '❌ Занят' : '✅ Свободен';
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`${status} **${car.name}**`));
    }
    container
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('📋 Выберите автомобиль для аренды:'));
    const options = [];
    for (const car of cars) {
        const status = car.is_occupied === 1 ? 'Занят' : 'Свободен';
        let label = `${car.name} — ${status}`;
        if (label.length > 100) {
            label = label.slice(0, 97) + '...';
        }
        options.push(new discord_js_1.StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setValue(car.id.toString())
            .setEmoji(car.is_occupied === 1 ? '❌' : '✅'));
    }
    const selectRow = new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId('cars_select')
        .setPlaceholder('Выберите автомобиль...')
        .addOptions(options)
        .setMinValues(1)
        .setMaxValues(1));
    container.addActionRowComponents(selectRow);
    const backRow = new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('cars_back')
        .setLabel('◀️ Назад')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    container.addActionRowComponents(backRow);
    return { container };
}
// ------ КОМАНДЫ ------
exports.carAddCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('авто-добавить')
        .setDescription('[ADMIN] Добавить машину')
        .addStringOption(opt => opt
        .setName('name')
        .setDescription('Название автомобиля')
        .setRequired(true)),
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
            const name = interaction.options.getString('name', true);
            try {
                await db.run(`INSERT INTO family_cars (name) VALUES (?)`, [name]);
                await interaction.reply({
                    content: `✅ Автомобиль **${name}** добавлен!`,
                    ephemeral: true
                });
                logger_1.logger.info(`Car added: ${name} by ${interaction.user.id}`);
            }
            catch (error) {
                await interaction.reply({
                    content: '❌ Ошибка при добавлении автомобиля (возможно, уже существует)',
                    ephemeral: true
                });
            }
        }
        catch (error) {
            console.error('Ошибка в carAddCommand:', error);
            await interaction.reply({ content: '❌ Произошла ошибка', ephemeral: true });
        }
    }
};
exports.carDeleteCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('авто-удалить')
        .setDescription('[ADMIN] Удалить машину')
        .addStringOption(opt => opt
        .setName('name')
        .setDescription('Название автомобиля для удаления')
        .setRequired(true)),
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
            const name = interaction.options.getString('name', true);
            const result = await db.run(`DELETE FROM family_cars WHERE name = ?`, [name]);
            if (result.changes && result.changes > 0) {
                await interaction.reply({
                    content: `✅ Автомобиль **${name}** удален!`,
                    ephemeral: true
                });
                logger_1.logger.info(`Car deleted: ${name} by ${interaction.user.id}`);
            }
            else {
                await interaction.reply({
                    content: `❌ Автомобиль **${name}** не найден`,
                    ephemeral: true
                });
            }
        }
        catch (error) {
            console.error('Ошибка в carDeleteCommand:', error);
            await interaction.reply({ content: '❌ Произошла ошибка', ephemeral: true });
        }
    }
};
exports.carsMenuCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('авто')
        .setDescription('Открыть меню отчетов по автомобилям'),
    async execute(interaction) {
        try {
            if (!interaction.isChatInputCommand())
                return;
            if (!db) {
                await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
                return;
            }
            const { container } = await buildCarsMenu(interaction);
            await interaction.reply({
                components: [container],
                flags: discord_js_1.MessageFlags.IsComponentsV2
            });
        }
        catch (error) {
            console.error('Ошибка в carsMenuCommand:', error);
            await interaction.reply({ content: '❌ Ошибка при создании меню', ephemeral: true });
        }
    }
};
// ------ ОБРАБОТЧИК КНОПОК ------
async function handleCarsButtons(interaction) {
    if (!interaction.isButton())
        return;
    if (!interaction.customId.startsWith('cars_'))
        return;
    if (!db) {
        await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
        return;
    }
    try {
        await interaction.deferUpdate();
        if (interaction.customId === 'cars_list') {
            const { container } = await buildCarsList(interaction);
            await interaction.editReply({
                components: [container]
            });
            return;
        }
        if (interaction.customId === 'cars_release') {
            const userCar = await db.get(`SELECT * FROM family_cars WHERE occupied_by = ?`, [interaction.user.id]);
            if (!userCar) {
                // Создаем сообщение об ошибке через контейнер
                const errorContainer = new discord_js_1.ContainerBuilder()
                    .setAccentColor(0xFF4444)
                    .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('❌ **У вас нет занятых автомобилей**'))
                    .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Вы не брали автомобиль в аренду.'));
                await interaction.editReply({
                    components: [errorContainer]
                });
                return;
            }
            await db.run(`UPDATE family_cars SET is_occupied = 0, occupied_by = NULL, occupied_at = NULL WHERE id = ?`, [userCar.id]);
            const { container } = await buildCarsMenu(interaction);
            await interaction.editReply({
                components: [container]
            });
            return;
        }
        if (interaction.customId === 'cars_back') {
            const { container } = await buildCarsMenu(interaction);
            await interaction.editReply({
                components: [container]
            });
            return;
        }
    }
    catch (error) {
        console.error('Ошибка в handleCarsButtons:', error);
        const errorContainer = new discord_js_1.ContainerBuilder()
            .setAccentColor(0xFF4444)
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('❌ **Произошла ошибка**'));
        await interaction.editReply({
            components: [errorContainer]
        });
    }
}
// Обработка селект-меню автомобилей
async function handleCarsSelect(interaction) {
    if (!interaction.isStringSelectMenu())
        return;
    if (interaction.customId !== 'cars_select')
        return;
    if (!db) {
        await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
        return;
    }
    try {
        await interaction.deferUpdate();
        const carId = parseInt(interaction.values[0]);
        const car = await db.get(`SELECT * FROM family_cars WHERE id = ?`, [carId]);
        if (!car) {
            const errorContainer = new discord_js_1.ContainerBuilder()
                .setAccentColor(0xFF4444)
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('❌ **Автомобиль не найден**'));
            await interaction.editReply({
                components: [errorContainer]
            });
            return;
        }
        if (car.is_occupied === 1) {
            const errorContainer = new discord_js_1.ContainerBuilder()
                .setAccentColor(0xFF4444)
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`❌ **Автомобиль ${car.name} уже занят!**`));
            await interaction.editReply({
                components: [errorContainer]
            });
            return;
        }
        const userCar = await db.get(`SELECT * FROM family_cars WHERE occupied_by = ?`, [interaction.user.id]);
        if (userCar) {
            const errorContainer = new discord_js_1.ContainerBuilder()
                .setAccentColor(0xFF4444)
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`❌ **Вы уже заняли автомобиль ${userCar.name}!**`), new discord_js_1.TextDisplayBuilder().setContent('Сначала освободите его через кнопку "Освободить текущий"'));
            await interaction.editReply({
                components: [errorContainer]
            });
            return;
        }
        const now = new Date();
        await db.run(`UPDATE family_cars SET is_occupied = 1, occupied_by = ?, occupied_at = ? WHERE id = ?`, [interaction.user.id, now.toISOString(), carId]);
        // Создаем сообщение об успехе через контейнер
        const successContainer = new discord_js_1.ContainerBuilder()
            .setAccentColor(0x00FF88)
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`✅ **Вы заняли автомобиль ${car.name}!**`), new discord_js_1.TextDisplayBuilder().setContent(`⏱️ Автомобиль ваш на **${RENTAL_DURATION} минут**.`), new discord_js_1.TextDisplayBuilder().setContent('🔔 Вы получите уведомление, когда время выйдет.'));
        await interaction.editReply({
            components: [successContainer]
        });
        // Автоматическое освобождение через 45 минут
        setTimeout(async () => {
            if (!db)
                return;
            try {
                const currentCar = await db.get(`SELECT * FROM family_cars WHERE id = ? AND occupied_by = ?`, [carId, interaction.user.id]);
                if (currentCar && currentCar.is_occupied === 1) {
                    await db.run(`UPDATE family_cars SET is_occupied = 0, occupied_by = NULL, occupied_at = NULL WHERE id = ?`, [carId]);
                    logger_1.logger.info(`Автомобиль ${car.name} автоматически освобожден (время вышло)`);
                    // Уведомляем пользователя в ЛС
                    try {
                        const user = await interaction.client.users.fetch(interaction.user.id);
                        await user.send({
                            content: `🔔 Ваше время аренды автомобиля **${car.name}** истекло! Автомобиль освобожден.`
                        });
                    }
                    catch (e) {
                        // Если у пользователя закрыты ЛС
                    }
                }
            }
            catch (e) {
                console.error('Ошибка автоматического освобождения:', e);
            }
        }, RENTAL_DURATION * 60 * 1000);
    }
    catch (error) {
        console.error('Ошибка в handleCarsSelect:', error);
        const errorContainer = new discord_js_1.ContainerBuilder()
            .setAccentColor(0xFF4444)
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('❌ **Ошибка при выборе автомобиля**'));
        await interaction.editReply({
            components: [errorContainer]
        });
    }
}
//# sourceMappingURL=cars.js.map