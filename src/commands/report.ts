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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
  CategoryChannel,
  GuildChannel,
  OverwriteType
} from 'discord.js';
import { Command } from './index';
import { Database } from 'sqlite';
import { logger } from '../utils/logger';

let db: Database | null = null;
let ticketCounter = 1;

// ID канала для логов (замените на ваш)
const LOG_CHANNEL_ID = 'YOUR_LOG_CHANNEL_ID'; // ID канала для логов

export function setReportDB(database: Database) {
  db = database;
  loadLastTicketNumber();
}

async function loadLastTicketNumber() {
  if (!db) return;
  try {
    const result = await db.get(`SELECT MAX(id) as max_id FROM reports`);
    if (result && result.max_id) {
      ticketCounter = result.max_id + 1;
    }
  } catch (error) {
    console.error('Ошибка загрузки номера тикета:', error);
  }
}

function isSendableChannel(channel: any): channel is TextChannel {
  if (!channel) return false;
  if (typeof channel.send !== 'function') return false;
  const sendableTypes = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.PublicThread,
    ChannelType.PrivateThread
  ];
  return channel.type !== undefined && sendableTypes.includes(channel.type);
}

// Получение или создание категории для тикетов
async function getOrCreateCategory(guild: any) {
  // Ищем существующую категорию
  let category = guild.channels.cache.find(
    (ch: any) => ch.type === ChannelType.GuildCategory && ch.name === '📋 Репорты'
  ) as CategoryChannel;

  if (!category) {
    category = await guild.channels.create({
      name: '📋 Репорты',
      type: ChannelType.GuildCategory,
    });
    logger.info('Создана категория "📋 Репорты"');
  }

  return category;
}

// Создание тикета
async function createTicket(
  interaction: CommandInteraction,
  reason: string,
  description: string
) {
  if (!db) throw new Error('Database not initialized');

  const ticketNumber = ticketCounter++;
  const now = new Date();

  await db.run(
    `INSERT INTO reports (reporter_id, reason, status, created_at) 
     VALUES (?, ?, ?, ?)`,
    [interaction.user.id, reason, 'open', now.toISOString()]
  );

  const guild = interaction.guild;
  if (!guild) throw new Error('Гильдия не найдена');

  // Получаем или создаем категорию
  const category = await getOrCreateCategory(guild);

  // Находим роль модератора
  const moderatorRole = guild.roles.cache.find(r => r.name === 'Модератор') || 
                        guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.Administrator));

  // Создаем канал для тикета
  const channelName = `тикет-${ticketNumber}`;
  
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      ...(moderatorRole ? [{
        id: moderatorRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      }] : [])
    ]
  });

  // Создаем приветственное сообщение в тикете
  const peachColor = 0xFFB07C;
  
  const container = new ContainerBuilder()
    .setAccentColor(peachColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`📋 **Тикет #${ticketNumber}**`),
      new TextDisplayBuilder().setContent(`👤 **Создатель:** ${interaction.user.username} (<@${interaction.user.id}>)`),
      new TextDisplayBuilder().setContent(`📌 **Причина:** ${reason}`),
      new TextDisplayBuilder().setContent(`📝 **Описание:**\n${description || 'Без описания'}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🔒 Дождитесь ответа модератора.')
    );

  // Кнопки управления тикетом
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_close_${ticketNumber}`)
        .setLabel('🔒 Закрыть тикет')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ticket_transcript_${ticketNumber}`)
        .setLabel('📄 Получить лог')
        .setStyle(ButtonStyle.Primary)
    );

  container.addActionRowComponents(row);

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });

  // Отдельно отправляем упоминание модераторов
  if (moderatorRole) {
    await channel.send({
      content: `<@&${moderatorRole.id}>`
    });
  }

  // Обновляем запись с ID канала
  await db.run(
    `UPDATE reports SET channel_id = ? WHERE id = ?`,
    [channel.id, ticketNumber]
  );

  return { ticketNumber, channel };
}

// Получение логов тикета
async function getTicketTranscript(channel: TextChannel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    let log = `=== ТИКЕТ #${channel.name.replace('тикет-', '')} ===\n`;
    log += `Создан: ${channel.createdAt.toLocaleString()}\n`;
    log += `Участников: ${channel.members.size}\n\n`;
    log += `=== ИСТОРИЯ СООБЩЕНИЙ ===\n\n`;

    const sortedMessages = messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    for (const [_, msg] of sortedMessages) {
      const timestamp = msg.createdAt.toLocaleString();
      const author = msg.author.tag;
      const content = msg.content || '[Вложение]';
      const attachments = msg.attachments.size > 0 ? ` (${msg.attachments.size} вложений)` : '';
      
      log += `[${timestamp}] ${author}: ${content}${attachments}\n`;
    }

    log += `\n=== КОНЕЦ ЛОГА ===\n`;
    return log;
  } catch (error) {
    console.error('Ошибка получения логов:', error);
    return null;
  }
}

// Построение меню для создания тикета (Components V2)
function buildTicketMenu() {
  const peachColor = 0xFFB07C;

  const container = new ContainerBuilder()
    .setAccentColor(peachColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📋 **Система репортов**'),
      new TextDisplayBuilder().setContent('Нажмите кнопку ниже, чтобы создать тикет для жалобы на пользователя.')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📌 **Правила:**'),
      new TextDisplayBuilder().setContent('• Опишите ситуацию максимально подробно'),
      new TextDisplayBuilder().setContent('• Прикрепите доказательства, если есть'),
      new TextDisplayBuilder().setContent('• Дождитесь ответа модератора')
    );

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('📝 Создать тикет')
        .setStyle(ButtonStyle.Primary)
    );

  container.addActionRowComponents(row);

  return { container };
}

// ------ КОМАНДЫ ------

// Создание меню репортов
export const reportMenuCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('репорт-меню')
    .setDescription('[ADMIN] Создать меню для создания тикетов') as SlashCommandBuilder,

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

      const channel = interaction.channel;
      if (!channel || !isSendableChannel(channel)) {
        await interaction.reply({ content: '❌ Эта команда работает только в текстовых каналах', ephemeral: true });
        return;
      }

      const { container } = buildTicketMenu();
      await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

      await interaction.reply({
        content: '✅ Меню репортов создано!',
        ephemeral: true
      });

      logger.info('Меню репортов создано в канале', channel.id);

    } catch (error) {
      console.error('Ошибка в reportMenuCommand:', error);
      await interaction.reply({ content: '❌ Ошибка при создании меню', ephemeral: true });
    }
  }
};

// ------ ОБРАБОТЧИК КНОПОК ------

export async function handleTicketButtons(interaction: ButtonInteraction) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('ticket_')) return;
  if (!db) {
    await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
    return;
  }

  try {
    // Кнопка "Создать тикет"
    if (interaction.customId === 'ticket_create') {
      // Открываем модальное окно
      const modal = new ModalBuilder()
        .setCustomId('ticket_modal')
        .setTitle('📝 Создание тикета');

      const reasonInput = new TextInputBuilder()
        .setCustomId('ticket_reason')
        .setLabel('Причина обращения')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например: Нарушение правил')
        .setRequired(true);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('ticket_description')
        .setLabel('Подробное описание')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Опишите ситуацию подробно...')
        .setRequired(true);

      const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
      const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

      modal.addComponents(row1, row2);
      await interaction.showModal(modal);
      return;
    }

    // Кнопка "Закрыть тикет"
    if (interaction.customId.startsWith('ticket_close_')) {
      const ticketNumber = parseInt(interaction.customId.replace('ticket_close_', ''));
      const channel = interaction.channel;
      
      if (!channel || !isSendableChannel(channel)) {
        await interaction.reply({ content: '❌ Ошибка: канал не найден', ephemeral: true });
        return;
      }

      // Получаем лог перед закрытием
      const transcript = await getTicketTranscript(channel);
      
      // Обновляем статус в БД
      await db.run(
        `UPDATE reports SET status = 'closed', closed_at = ? WHERE id = ?`,
        [new Date().toISOString(), ticketNumber]
      );

      // Отправляем лог в канал логов
      const guild = interaction.guild;
      if (guild && LOG_CHANNEL_ID && LOG_CHANNEL_ID !== 'YOUR_LOG_CHANNEL_ID') {
        const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID) as TextChannel;
        if (logChannel && isSendableChannel(logChannel)) {
          const embed = new EmbedBuilder()
            .setTitle(`📄 Лог тикета #${ticketNumber}`)
            .setColor('#FFB07C')
            .addFields(
              { name: '📋 Статус', value: 'Закрыт', inline: true },
              { name: '👤 Закрыл', value: interaction.user.username, inline: true },
              { name: '📅 Дата закрытия', value: new Date().toLocaleString(), inline: false }
            )
            .setTimestamp();

          await logChannel.send({
            embeds: [embed],
            files: [{
              attachment: Buffer.from(transcript || 'Нет данных', 'utf-8'),
              name: `тикет-${ticketNumber}-лог.txt`
            }]
          });
        }
      }

      // Закрываем канал
      await channel.send({
        content: `🔒 Тикет #${ticketNumber} закрыт пользователем ${interaction.user.username}.`
      });

      // Удаляем права на просмотр у всех
      await channel.permissionOverwrites.edit(interaction.guild?.id || '', {
        ViewChannel: false
      });

      // Оставляем доступ только для модераторов
      const moderatorRole = interaction.guild?.roles.cache.find(r => r.name === 'Модератор') || 
                           interaction.guild?.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.Administrator));

      if (moderatorRole) {
        await channel.permissionOverwrites.edit(moderatorRole.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
      }

      await interaction.reply({
        content: `✅ Тикет #${ticketNumber} закрыт! Лог отправлен в канал логов.`,
        ephemeral: true
      });

      return;
    }

    // Кнопка "Получить лог"
    if (interaction.customId.startsWith('ticket_transcript_')) {
      const channel = interaction.channel;
      if (!channel || !isSendableChannel(channel)) {
        await interaction.reply({ content: '❌ Ошибка: канал не найден', ephemeral: true });
        return;
      }

      const transcript = await getTicketTranscript(channel);
      
      if (!transcript) {
        await interaction.reply({
          content: '❌ Не удалось получить лог',
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        files: [{
          attachment: Buffer.from(transcript, 'utf-8'),
          name: `тикет-лог.txt`
        }],
        ephemeral: true
      });
    }

  } catch (error) {
    console.error('Ошибка в handleTicketButtons:', error);
    await interaction.reply({ content: '❌ Ошибка при обработке', ephemeral: true });
  }
}

// Обработка модального окна создания тикета
export async function handleTicketModal(interaction: any) {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId !== 'ticket_modal') return;

  try {
    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.fields.getTextInputValue('ticket_reason');
    const description = interaction.fields.getTextInputValue('ticket_description');

    const { ticketNumber, channel } = await createTicket(
      interaction,
      reason,
      description
    );

    await interaction.editReply({
      content: `✅ Тикет #${ticketNumber} создан!\nКанал: ${channel.toString()}`
    });

    logger.info(`Тикет #${ticketNumber} создан пользователем ${interaction.user.id}`);

  } catch (error) {
    console.error('Ошибка в handleTicketModal:', error);
    await interaction.editReply({
      content: '❌ Ошибка при создании тикета'
    });
  }
}

// Команда для просмотра активных тикетов (админ)
export const ticketListCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('тикеты')
    .setDescription('[ADMIN] Показать список активных тикетов') as SlashCommandBuilder,

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

      const tickets = await db.all(
        `SELECT * FROM reports WHERE status = 'open' ORDER BY created_at ASC`
      );

      if (tickets.length === 0) {
        await interaction.reply({
          content: '📭 Нет активных тикетов',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📋 Активные тикеты')
        .setColor('#FFB07C')
        .setDescription(`Всего активных тикетов: ${tickets.length}`)
        .setTimestamp();

      for (const t of tickets) {
        const reporter = await interaction.client.users.fetch(t.reporter_id).catch(() => null);
        
        embed.addFields({
          name: `#${t.id} - ${t.reason}`,
          value: `👤 Создатель: ${reporter?.username || 'Неизвестный'}\n📅 ${new Date(t.created_at).toLocaleString()}`,
          inline: false
        });
      }

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Ошибка в ticketListCommand:', error);
      await interaction.reply({ content: '❌ Ошибка при получении списка', ephemeral: true });
    }
  }
};