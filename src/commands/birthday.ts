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
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ChannelType,
  TextChannel,
  NewsChannel,
  StageChannel,
  VoiceChannel,
  ThreadChannel,
  DMChannel,
  GuildBasedChannel
} from 'discord.js';
import { Command } from './index';
import { Database } from 'sqlite';
import { logger } from '../utils/logger';
import { config } from '../config';

let db: Database | null = null;
let currentSeasonIndex = 0;

const seasons = [
  { name: '❄️ Зима', months: [12, 1, 2] },
  { name: '🌸 Весна', months: [3, 4, 5] },
  { name: '☀️ Лето', months: [6, 7, 8] },
  { name: '🍂 Осень', months: [9, 10, 11] }
];

const monthNames = [
  'Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня',
  'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'
];

// Хранилище ID сообщений календаря для каждого канала
export const calendarMessages: Map<string, string> = new Map();

export function setBirthdayDB(database: Database) {
  db = database;
}

// ------ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ------

// Получение отображаемого имени пользователя на сервере (только никнейм)
async function getMemberDisplayName(interaction: CommandInteraction | ButtonInteraction, userId: string): Promise<string> {
  try {
    const guild = interaction.guild;
    if (!guild) return 'Неизвестный';
    let member = guild.members.cache.get(userId);
    if (!member) {
      member = await guild.members.fetch(userId).catch(() => undefined);
    }
    if (!member) return 'Неизвестный';
    return member.nickname || member.user.displayName || member.user.username;
  } catch {
    return 'Неизвестный';
  }
}

// Преобразование даты ДД/ММ в формат "ДД Месяц"
function formatBirthdayDate(dateStr: string): string {
  const [day, month] = dateStr.split('/').map(Number);
  return `${day} ${monthNames[month - 1]}`;
}

// Проверка, является ли канал текстовым каналом для отправки
function isSendableChannel(channel: any): channel is TextChannel | NewsChannel | StageChannel | VoiceChannel | ThreadChannel | DMChannel {
  if (!channel) return false;
  
  // Проверяем наличие метода send
  if (typeof channel.send !== 'function') return false;
  
  // Проверяем тип канала
  const sendableTypes = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.DM,
    ChannelType.GroupDM
  ];
  
  return channel.type !== undefined && sendableTypes.includes(channel.type);
}

// Построение контейнера с кнопками для сезона
async function buildSeasonComponents(interaction: CommandInteraction | ButtonInteraction, seasonIndex: number) {
  if (!db) throw new Error('Database not initialized');

  const season = seasons[seasonIndex];
  const monthNumbers = season.months.map(m => m.toString().padStart(2, '0'));

  // Запрос в БД
  const placeholders = monthNumbers.map(() => '?').join(',');
  const birthdays = await db.all(
    `SELECT user_id, birthday_date FROM birthdays 
     WHERE substr(birthday_date, 4, 2) IN (${placeholders})
     ORDER BY 
       CASE substr(birthday_date, 4, 2)
         ${monthNumbers.map((m, i) => `WHEN '${m}' THEN ${i}`).join(' ')}
       END,
       substr(birthday_date, 1, 2)`,
    monthNumbers
  );

  const peachColor = 0xFFB07C;
  const now = new Date();
  const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  const currentDay = now.getDate().toString().padStart(2, '0');

  // Создаём контейнер
  const container = new ContainerBuilder()
    .setAccentColor(peachColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${season.name} 🌿`),
      new TextDisplayBuilder().setContent(`📅 Всего именинников: ${birthdays.length}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

  if (birthdays.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📭 *В этом сезоне нет именинников*')
    );
  } else {
    for (const item of birthdays) {
      const displayName = await getMemberDisplayName(interaction, item.user_id);
      const [day, month] = item.birthday_date.split('/');
      const formattedDate = formatBirthdayDate(item.birthday_date);
      
      let statusEmoji = '⏳';
      if (month < currentMonth || (month === currentMonth && day < currentDay)) statusEmoji = '✅';
      else if (month === currentMonth && day === currentDay) statusEmoji = '🎉';
      
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${statusEmoji} **${displayName}** | ${formattedDate}`)
      );
    }
  }

  container
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`📖 Страница ${seasonIndex + 1}/${seasons.length}`)
    );

  // Кнопки добавляем прямо в контейнер
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('season_prev')
        .setLabel('◀️ Назад')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(seasonIndex === 0),
      new ButtonBuilder()
        .setCustomId('season_next')
        .setLabel('Вперед ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(seasonIndex === seasons.length - 1)
    );

  container.addActionRowComponents(row);

  return { container };
}

// Обновление календаря в канале (если существует)
export async function updateCalendarIfExists(channel: TextChannel | NewsChannel | StageChannel | VoiceChannel | ThreadChannel | DMChannel) {
  const channelId = channel.id;
  const messageId = calendarMessages.get(channelId);
  if (!messageId) return;

  try {
    const message = await channel.messages.fetch(messageId);
    if (!message) {
      calendarMessages.delete(channelId);
      return;
    }

    // Создаем искусственный interaction объект для передачи в buildSeasonComponents
    const fakeInteraction = {
      guild: message.guild,
      client: message.client
    } as any;

    const { container } = await buildSeasonComponents(fakeInteraction, currentSeasonIndex);
    await message.edit({ components: [container] });
  } catch (error) {
    console.error('Ошибка обновления календаря:', error);
    calendarMessages.delete(channelId);
  }
}

// ------ КОМАНДЫ ------

// Установка своего дня рождения
export const birthdaySetCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Установить свой день рождения')
    .addStringOption(opt =>
      opt
        .setName('date')
        .setDescription('Дата в формате ДД/ММ (например: 15/08)')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (!db) {
        await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
        return;
      }

      const date = interaction.options.getString('date', true);
      if (!/^\d{2}\/\d{2}$/.test(date)) {
        await interaction.reply({ content: '❌ Неверный формат! Используйте ДД/ММ (например: 15/08)', ephemeral: true });
        return;
      }
      const [day, month] = date.split('/').map(Number);
      if (day < 1 || day > 31 || month < 1 || month > 12) {
        await interaction.reply({ content: '❌ Неверная дата! День: 1-31, Месяц: 1-12', ephemeral: true });
        return;
      }

      await db.run(
        `INSERT INTO birthdays (user_id, birthday_date) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET birthday_date = ?, updated_at = CURRENT_TIMESTAMP`,
        [interaction.user.id, date, date]
      );

      await interaction.reply({ content: `✅ Ваш день рождения установлен на **${date}**! 🎉`, ephemeral: true });
      logger.info(`User ${interaction.user.id} set birthday to ${date}`);

      // Обновляем календарь, если он существует в этом канале
      if (interaction.channel && isSendableChannel(interaction.channel)) {
        await updateCalendarIfExists(interaction.channel);
      }
    } catch (error) {
      console.error('Ошибка в birthdaySetCommand:', error);
      await interaction.reply({ content: '❌ Произошла ошибка', ephemeral: true }).catch(() => {});
    }
  }
};

// Просмотр списка (по сезонам) – создает постоянное сообщение в канале
export const birthdayListCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('birthdaylist')
    .setDescription('Показать календарь дней рождения') as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (!db) {
        await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
        return;
      }

      const channel = interaction.channel;
      if (!channel || !isSendableChannel(channel)) {
        await interaction.reply({ content: '❌ Эта команда работает только в текстовых каналах', ephemeral: true });
        return;
      }

      currentSeasonIndex = 0;
      const { container } = await buildSeasonComponents(interaction, 0);

      // Проверяем, есть ли уже сообщение календаря в этом канале
      const channelId = channel.id;
      const existingMessageId = calendarMessages.get(channelId);

      if (existingMessageId) {
        try {
          const existingMessage = await channel.messages.fetch(existingMessageId);
          if (existingMessage) {
            await existingMessage.edit({ components: [container] });
            await interaction.reply({ content: '✅ Календарь обновлен!', ephemeral: true });
            return;
          }
        } catch (error) {
          // Сообщение не найдено, удаляем из хранилища
          calendarMessages.delete(channelId);
        }
      }

      // Отправляем новое сообщение с флагом Components V2
      const sentMessage = await channel.send({ 
        components: [container], 
        flags: MessageFlags.IsComponentsV2 
      });
      calendarMessages.set(channelId, sentMessage.id);
      await interaction.reply({ content: '✅ Календарь создан!', ephemeral: true });
    } catch (error) {
      console.error('Ошибка в birthdayListCommand:', error);
      await interaction.reply({ content: '❌ Ошибка при создании календаря', ephemeral: true });
    }
  }
};

// Администратор: установка дня рождения другому пользователю
export const adminBirthdaySetCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('adminbirthday')
    .setDescription('[ADMIN] Установить день рождения пользователю')
    .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
    .addStringOption(opt => opt.setName('date').setDescription('Дата в формате ДД/ММ').setRequired(true)) as SlashCommandBuilder,

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

      const targetUser = interaction.options.getUser('user', true);
      const date = interaction.options.getString('date', true);
      if (!/^\d{2}\/\d{2}$/.test(date)) {
        await interaction.reply({ content: '❌ Неверный формат! Используйте ДД/ММ', ephemeral: true });
        return;
      }
      const [day, month] = date.split('/').map(Number);
      if (day < 1 || day > 31 || month < 1 || month > 12) {
        await interaction.reply({ content: '❌ Неверная дата!', ephemeral: true });
        return;
      }

      await db.run(
        `INSERT INTO birthdays (user_id, birthday_date) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET birthday_date = ?, updated_at = CURRENT_TIMESTAMP`,
        [targetUser.id, date, date]
      );

      await interaction.reply({ content: `✅ День рождения для **${targetUser.username}** установлен на **${date}**! 🎉`, ephemeral: true });

      // Обновляем календарь, если он существует в этом канале
      if (interaction.channel && isSendableChannel(interaction.channel)) {
        await updateCalendarIfExists(interaction.channel);
      }
    } catch (error) {
      console.error('Ошибка в adminBirthdaySetCommand:', error);
      await interaction.reply({ content: '❌ Произошла ошибка', ephemeral: true }).catch(() => {});
    }
  }
};

// Удаление своего дня рождения
export const birthdayDeleteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('birthdaydelete')
    .setDescription('Удалить свой день рождения') as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (!db) {
        await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
        return;
      }

      const result = await db.run(`DELETE FROM birthdays WHERE user_id = ?`, [interaction.user.id]);
      if (result.changes && result.changes > 0) {
        await interaction.reply({ content: '✅ Ваш день рождения удален!', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ У вас не установлен день рождения', ephemeral: true });
      }

      // Обновляем календарь, если он существует в этом канале
      if (interaction.channel && isSendableChannel(interaction.channel)) {
        await updateCalendarIfExists(interaction.channel);
      }
    } catch (error) {
      console.error('Ошибка в birthdayDeleteCommand:', error);
      await interaction.reply({ content: '❌ Произошла ошибка', ephemeral: true }).catch(() => {});
    }
  }
};

// ------ НОВАЯ КОМАНДА: ТЕСТОВОЕ ПОЗДРАВЛЕНИЕ ------

export const testBirthdayCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('testbirthday')
    .setDescription('[TEST] Отправить тестовое поздравление с днём рождения')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('Пользователь, которого поздравляем (по умолчанию вы)')
        .setRequired(false)
    )
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Канал для отправки (по умолчанию канал из конфига)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
    ) as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;

      // Получаем пользователя (по умолчанию автор)
      const targetUser = interaction.options.getUser('user') || interaction.user;
      
      // Получаем канал (по умолчанию из конфига)
      let channel: TextChannel | NewsChannel | StageChannel | VoiceChannel | ThreadChannel | DMChannel | null = null;
      const channelOption = interaction.options.getChannel('channel');
      
      if (channelOption && isSendableChannel(channelOption)) {
        channel = channelOption;
      } else {
        // Пытаемся найти канал по ID из конфига
        const channelId = config.birthdayChannelId;
        if (channelId) {
          const guild = interaction.guild;
          if (guild) {
            const found = guild.channels.cache.get(channelId);
            if (found && isSendableChannel(found)) {
              channel = found;
            }
          }
        }
        // Если не нашли, используем текущий канал
        if (!channel && interaction.channel && isSendableChannel(interaction.channel)) {
          channel = interaction.channel;
        }
      }

      if (!channel) {
        await interaction.reply({ content: '❌ Не удалось найти канал для отправки', ephemeral: true });
        return;
      }

      // Строим поздравление
      const peachColor = 0xFFB07C;
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const date = `${day}/${month}`;

      const container = new ContainerBuilder()
        .setAccentColor(peachColor)
        .addMediaGalleryComponents(
          new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL('https://i.imgur.com/8Km9tLL.png'))
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`🎉 **С ДНЕМ РОЖДЕНИЯ!** 🎉`),
          new TextDisplayBuilder().setContent(`**${targetUser.username}**, поздравляем тебя с этим прекрасным днем! 🥳`)
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('✨ Желаем тебе счастья, здоровья и удачи! ✨'),
          new TextDisplayBuilder().setContent('🍀 Пусть все твои мечты сбываются! 🍀')
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`📅 Сегодня: ${date}`));

      // Отправляем в канал
      await channel.send({ 
        components: [container], 
        flags: MessageFlags.IsComponentsV2 
      });

      await interaction.reply({ 
        content: `✅ Тестовое поздравление отправлено в канал ${channel.toString()}!`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Ошибка в testBirthdayCommand:', error);
      await interaction.reply({ content: '❌ Ошибка при отправке тестового поздравления', ephemeral: true });
    }
  }
};

// ------ ОБРАБОТЧИК КНОПОК ------

export async function handleBirthdayButtons(interaction: ButtonInteraction) {
  if (!interaction.customId || !interaction.customId.startsWith('season_')) return;
  
  if (!db) {
    await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
    return;
  }

  try {
    await interaction.deferUpdate();

    let newSeason = currentSeasonIndex;
    if (interaction.customId === 'season_prev') newSeason--;
    else if (interaction.customId === 'season_next') newSeason++;
    newSeason = Math.max(0, Math.min(seasons.length - 1, newSeason));
    currentSeasonIndex = newSeason;

    const { container } = await buildSeasonComponents(interaction, newSeason);
    await interaction.editReply({ components: [container] });
  } catch (error) {
    console.error('Ошибка в handleBirthdayButtons:', error);
    await interaction.editReply({ content: '❌ Ошибка при навигации', components: [] }).catch(() => {});
  }
}

// ------ АВТОМАТИЧЕСКОЕ ПОЗДРАВЛЕНИЕ ------

export async function checkBirthdays(client: any) {
  if (!db) return;
  try {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const date = `${day}/${month}`;

    const birthdayUsers = await db.all(`SELECT user_id FROM birthdays WHERE birthday_date = ?`, [date]);
    if (birthdayUsers.length === 0) return;

    const peachColor = 0xFFB07C;

    // Определяем канал для поздравлений
    let channel: TextChannel | NewsChannel | StageChannel | VoiceChannel | ThreadChannel | DMChannel | null = null;
    const guild = client.guilds.cache.first();
    if (guild) {
      const channelId = config.birthdayChannelId;
      if (channelId) {
        const found = guild.channels.cache.get(channelId);
        if (found && isSendableChannel(found)) {
          channel = found;
        }
      }
      if (!channel) {
        // fallback: ищем канал с именем 'общий'
        for (const [, ch] of guild.channels.cache) {
          // Проверяем, что это текстовый канал (не DM) и есть имя
          if (isSendableChannel(ch) && 'name' in ch && ch.name === 'общий') {
            channel = ch;
            break;
          }
        }
      }
    }

    if (!channel) {
      logger.warn('❌ Не найден канал для отправки поздравлений');
      return;
    }

    for (const userData of birthdayUsers) {
      try {
        const user = await client.users.fetch(userData.user_id);
        if (!user) continue;

        const container = new ContainerBuilder()
          .setAccentColor(peachColor)
          .addMediaGalleryComponents(
            new MediaGalleryBuilder()
              .addItems(new MediaGalleryItemBuilder().setURL('https://i.imgur.com/8Km9tLL.png'))
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`🎉 **С ДНЕМ РОЖДЕНИЯ!** 🎉`),
            new TextDisplayBuilder().setContent(`**${user.username}**, поздравляем тебя с этим прекрасным днем! 🥳`)
          )
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('✨ Желаем тебе счастья, здоровья и удачи! ✨'),
            new TextDisplayBuilder().setContent('🍀 Пусть все твои мечты сбываются! 🍀')
          )
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`📅 Сегодня: ${date}`));

        await channel.send({ 
          components: [container], 
          flags: MessageFlags.IsComponentsV2 
        });
        logger.info(`🎉 Отправлено поздравление для ${user.username} (${date})`);
      } catch (e) {
        console.error(`Ошибка отправки поздравления для ${userData.user_id}:`, e);
      }
    }
  } catch (error) {
    console.error('Ошибка проверки дней рождения:', error);
  }
}