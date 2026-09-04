import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { Command } from './index';
import { Database } from 'sqlite';
import { logger } from '../utils/logger';

let db: Database | null = null;
const RENTAL_DURATION = 45; // минут

export function setCarsDB(database: Database) {
  db = database;
}

// Получение отображаемого имени пользователя
async function getUserDisplayName(interaction: CommandInteraction | ButtonInteraction, userId: string): Promise<string> {
  try {
    const guild = interaction.guild;
    if (!guild) return 'Неизвестный';
    const member = await guild.members.fetch(userId).catch(() => undefined);
    if (!member) return 'Неизвестный';
    return member.nickname || member.user.displayName || member.user.username;
  } catch {
    return 'Неизвестный';
  }
}

// Построение главного меню автомобилей (Components V2)
async function buildCarsMenu(interaction: CommandInteraction | ButtonInteraction) {
  if (!db) throw new Error('Database not initialized');

  const cars = await db.all(
    `SELECT * FROM family_cars ORDER BY name`
  );

  const peachColor = 0xFFB07C;
  const now = new Date();

  const occupiedCars = cars.filter((c: any) => c.is_occupied === 1);
  const freeCars = cars.filter((c: any) => c.is_occupied === 0);

  const container = new ContainerBuilder()
    .setAccentColor(peachColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🚗 **Отчеты на автомобили**')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🚦 **Занятые автомобили:**')
    );

  if (occupiedCars.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📭 *Нет занятых автомобилей*')
    );
  } else {
    for (const car of occupiedCars) {
      const user = await interaction.client.users.fetch(car.occupied_by).catch(() => null);
      const username = user ? await getUserDisplayName(interaction, car.occupied_by) : 'Неизвестный';
      const occupiedAt = new Date(car.occupied_at);
      const minutesPassed = Math.floor((now.getTime() - occupiedAt.getTime()) / 60000);
      const minutesLeft = Math.max(0, RENTAL_DURATION - minutesPassed);
      
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`❌ **${car.name}** — ${username} (осталось ${minutesLeft} мин)`)
      );
    }
  }

  container
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🟢 **Свободные автомобили:**')
    );

  if (freeCars.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📭 *Нет свободных автомобилей*')
    );
  } else {
    for (const car of freeCars) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`✅ **${car.name}** — свободен`)
      );
    }
  }

  container
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`📊 Всего автомобилей: ${cars.length} (Занято: ${occupiedCars.length})`)
    );

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('cars_list')
        .setLabel('📋 Список автомобилей')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('cars_release')
        .setLabel('🔓 Освободить текущий')
        .setStyle(ButtonStyle.Success)
    );

  container.addActionRowComponents(row);

  return { container };
}

// Построение списка автомобилей с селект-меню (Components V2)
async function buildCarsList(interaction: CommandInteraction | ButtonInteraction) {
  if (!db) throw new Error('Database not initialized');

  const cars = await db.all(
    `SELECT * FROM family_cars ORDER BY name`
  );

  const peachColor = 0xFFB07C;

  const container = new ContainerBuilder()
    .setAccentColor(peachColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🚗 **Отчеты на автомобили**')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Выберите желаемый автомобиль из списка ниже!')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

  for (const car of cars) {
    const status = car.is_occupied === 1 ? '❌ Занят' : '✅ Свободен';
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${status} **${car.name}**`)
    );
  }

  container
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📋 Выберите автомобиль для аренды:')
    );

  const options: StringSelectMenuOptionBuilder[] = [];
  
  for (const car of cars) {
    const status = car.is_occupied === 1 ? 'Занят' : 'Свободен';
    let label = `${car.name} — ${status}`;
    if (label.length > 100) {
      label = label.slice(0, 97) + '...';
    }
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setValue(car.id.toString())
        .setEmoji(car.is_occupied === 1 ? '❌' : '✅')
    );
  }

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('cars_select')
        .setPlaceholder('Выберите автомобиль...')
        .addOptions(options)
        .setMinValues(1)
        .setMaxValues(1)
    );

  container.addActionRowComponents(selectRow);

  const backRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('cars_back')
        .setLabel('◀️ Назад')
        .setStyle(ButtonStyle.Secondary)
    );

  container.addActionRowComponents(backRow);

  return { container };
}

// ------ КОМАНДЫ ------

export const carAddCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('авто-добавить')
    .setDescription('[ADMIN] Добавить машину')
    .addStringOption(opt =>
      opt
        .setName('name')
        .setDescription('Название автомобиля')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;
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
        await db.run(
          `INSERT INTO family_cars (name) VALUES (?)`,
          [name]
        );

        await interaction.reply({
          content: `✅ Автомобиль **${name}** добавлен!`,
          ephemeral: true
        });
        logger.info(`Car added: ${name} by ${interaction.user.id}`);
      } catch (error) {
        await interaction.reply({
          content: '❌ Ошибка при добавлении автомобиля (возможно, уже существует)',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Ошибка в carAddCommand:', error);
      await interaction.reply({ content: '❌ Произошла ошибка', ephemeral: true });
    }
  }
};

export const carDeleteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('авто-удалить')
    .setDescription('[ADMIN] Удалить машину')
    .addStringOption(opt =>
      opt
        .setName('name')
        .setDescription('Название автомобиля для удаления')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (!interaction.memberPermissions?.has('Administrator')) {
        await interaction.reply({ content: '❌ У вас нет прав администратора!', ephemeral: true });
        return;
      }
      if (!db) {
        await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
        return;
      }

      const name = interaction.options.getString('name', true);

      const result = await db.run(
        `DELETE FROM family_cars WHERE name = ?`,
        [name]
      );

      if (result.changes && result.changes > 0) {
        await interaction.reply({
          content: `✅ Автомобиль **${name}** удален!`,
          ephemeral: true
        });
        logger.info(`Car deleted: ${name} by ${interaction.user.id}`);
      } else {
        await interaction.reply({
          content: `❌ Автомобиль **${name}** не найден`,
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Ошибка в carDeleteCommand:', error);
      await interaction.reply({ content: '❌ Произошла ошибка', ephemeral: true });
    }
  }
};

export const carsMenuCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('авто')
    .setDescription('Открыть меню отчетов по автомобилям') as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (!db) {
        await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
        return;
      }

      const { container } = await buildCarsMenu(interaction);
      await interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (error) {
      console.error('Ошибка в carsMenuCommand:', error);
      await interaction.reply({ content: '❌ Ошибка при создании меню', ephemeral: true });
    }
  }
};

// ------ ОБРАБОТЧИК КНОПОК ------

export async function handleCarsButtons(interaction: ButtonInteraction) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('cars_')) return;
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
      const userCar = await db.get(
        `SELECT * FROM family_cars WHERE occupied_by = ?`,
        [interaction.user.id]
      );

      if (!userCar) {
        // Создаем сообщение об ошибке через контейнер
        const errorContainer = new ContainerBuilder()
          .setAccentColor(0xFF4444)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('❌ **У вас нет занятых автомобилей**')
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('Вы не брали автомобиль в аренду.')
          );

        await interaction.editReply({
          components: [errorContainer]
        });
        return;
      }

      await db.run(
        `UPDATE family_cars SET is_occupied = 0, occupied_by = NULL, occupied_at = NULL WHERE id = ?`,
        [userCar.id]
      );

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
  } catch (error) {
    console.error('Ошибка в handleCarsButtons:', error);
    const errorContainer = new ContainerBuilder()
      .setAccentColor(0xFF4444)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('❌ **Произошла ошибка**')
      );

    await interaction.editReply({
      components: [errorContainer]
    });
  }
}

// Обработка селект-меню автомобилей
export async function handleCarsSelect(interaction: any) {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'cars_select') return;
  if (!db) {
    await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
    return;
  }

  try {
    await interaction.deferUpdate();

    const carId = parseInt(interaction.values[0]);
    
    const car = await db.get(
      `SELECT * FROM family_cars WHERE id = ?`,
      [carId]
    );

    if (!car) {
      const errorContainer = new ContainerBuilder()
        .setAccentColor(0xFF4444)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('❌ **Автомобиль не найден**')
        );

      await interaction.editReply({
        components: [errorContainer]
      });
      return;
    }

    if (car.is_occupied === 1) {
      const errorContainer = new ContainerBuilder()
        .setAccentColor(0xFF4444)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`❌ **Автомобиль ${car.name} уже занят!**`)
        );

      await interaction.editReply({
        components: [errorContainer]
      });
      return;
    }

    const userCar = await db.get(
      `SELECT * FROM family_cars WHERE occupied_by = ?`,
      [interaction.user.id]
    );

    if (userCar) {
      const errorContainer = new ContainerBuilder()
        .setAccentColor(0xFF4444)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`❌ **Вы уже заняли автомобиль ${userCar.name}!**`),
          new TextDisplayBuilder().setContent('Сначала освободите его через кнопку "Освободить текущий"')
        );

      await interaction.editReply({
        components: [errorContainer]
      });
      return;
    }

    const now = new Date();
    await db.run(
      `UPDATE family_cars SET is_occupied = 1, occupied_by = ?, occupied_at = ? WHERE id = ?`,
      [interaction.user.id, now.toISOString(), carId]
    );

    // Создаем сообщение об успехе через контейнер
    const successContainer = new ContainerBuilder()
      .setAccentColor(0x00FF88)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`✅ **Вы заняли автомобиль ${car.name}!**`),
        new TextDisplayBuilder().setContent(`⏱️ Автомобиль ваш на **${RENTAL_DURATION} минут**.`),
        new TextDisplayBuilder().setContent('🔔 Вы получите уведомление, когда время выйдет.')
      );

    await interaction.editReply({
      components: [successContainer]
    });

    // Автоматическое освобождение через 45 минут
    setTimeout(async () => {
      if (!db) return;
      
      try {
        const currentCar = await db.get(
          `SELECT * FROM family_cars WHERE id = ? AND occupied_by = ?`,
          [carId, interaction.user.id]
        );
        if (currentCar && currentCar.is_occupied === 1) {
          await db.run(
            `UPDATE family_cars SET is_occupied = 0, occupied_by = NULL, occupied_at = NULL WHERE id = ?`,
            [carId]
          );
          logger.info(`Автомобиль ${car.name} автоматически освобожден (время вышло)`);
          
          // Уведомляем пользователя в ЛС
          try {
            const user = await interaction.client.users.fetch(interaction.user.id);
            await user.send({
              content: `🔔 Ваше время аренды автомобиля **${car.name}** истекло! Автомобиль освобожден.`
            });
          } catch (e) {
            // Если у пользователя закрыты ЛС
          }
        }
      } catch (e) {
        console.error('Ошибка автоматического освобождения:', e);
      }
    }, RENTAL_DURATION * 60 * 1000);

  } catch (error) {
    console.error('Ошибка в handleCarsSelect:', error);
    const errorContainer = new ContainerBuilder()
      .setAccentColor(0xFF4444)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('❌ **Ошибка при выборе автомобиля**')
      );

    await interaction.editReply({
      components: [errorContainer]
    });
  }
}