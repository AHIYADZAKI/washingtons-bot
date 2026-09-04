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
  PermissionFlagsBits
} from 'discord.js';
import { Command } from './index';
import { Database } from 'sqlite';
import { logger } from '../utils/logger';

let db: Database | null = null;

export function setGiveawayDB(database: Database) {
  db = database;
}

// Создание розыгрыша
async function createGiveaway(
  interaction: CommandInteraction,
  prize: string,
  winnersCount: number,
  durationHours: number,
  description: string
) {
  if (!db) throw new Error('Database not initialized');

  const now = new Date();
  const endAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

  const result = await db.run(
    `INSERT INTO giveaways (prize, winners_count, description, end_at, created_at) 
     VALUES (?, ?, ?, ?, ?)`,
    [prize, winnersCount, description || null, endAt.toISOString(), now.toISOString()]
  );

  const giveawayId = result.lastID;

  return { giveawayId, endAt };
}

// Получение информации о розыгрыше
async function getGiveaway(giveawayId: number) {
  if (!db) return null;
  return await db.get(
    `SELECT * FROM giveaways WHERE id = ?`,
    [giveawayId]
  );
}

// Обновление статуса розыгрыша
async function updateGiveawayStatus(giveawayId: number, ended: boolean) {
  if (!db) return;
  await db.run(
    `UPDATE giveaways SET ended = ? WHERE id = ?`,
    [ended ? 1 : 0, giveawayId]
  );
}

// Проверка завершенных розыгрышей (запускается каждую минуту)
export async function checkGiveaways(client: any) {
  if (!db) return;
  try {
    const now = new Date();
    const endedGiveaways = await db.all(
      `SELECT * FROM giveaways WHERE ended = 0 AND end_at <= ?`,
      [now.toISOString()]
    );

    for (const giveaway of endedGiveaways) {
      await endGiveaway(client, giveaway);
    }
  } catch (error) {
    console.error('Ошибка проверки розыгрышей:', error);
  }
}

// Завершение розыгрыша
async function endGiveaway(client: any, giveaway: any) {
  if (!db) return;

  try {
    // Получаем всех участников из реакции
    const guild = client.guilds.cache.first();
    if (!guild) return;

    // Ищем сообщение с розыгрышем
    let message = null;
    try {
      const channel = guild.channels.cache.get(giveaway.channel_id);
      if (channel && channel.isTextBased()) {
        message = await channel.messages.fetch(giveaway.message_id);
      }
    } catch (error) {
      console.log('Сообщение розыгрыша не найдено');
    }

    let winners: string[] = [];

    if (message) {
      // Получаем участников из реакции 🎉
      const reaction = message.reactions.cache.get('🎉');
      if (reaction) {
        const users = await reaction.users.fetch();
        const participants = users.filter((user: any) => !user.bot);
        const participantsArray = Array.from(participants.keys()) as string[];

        if (participantsArray.length > 0) {
          // Выбираем победителей
          const shuffled = participantsArray.sort(() => 0.5 - Math.random());
          winners = shuffled.slice(0, giveaway.winners_count);
        }
      }
    }

    // Обновляем статус
    await updateGiveawayStatus(giveaway.id, true);

    // Отправляем результаты
    const channel = guild.channels.cache.get(giveaway.channel_id);
    if (channel && channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('🏆 **РОЗЫГРЫШ ЗАВЕРШЕН!** 🏆')
        .setColor('#FFD700')
        .setDescription(`**Приз:** ${giveaway.prize}`)
        .addFields(
          { 
            name: '👑 Победители', 
            value: winners.length > 0 
              ? winners.map((w: string) => `<@${w}>`).join('\n') 
              : '❌ Нет участников', 
            inline: false 
          },
          { 
            name: '📅 Дата завершения', 
            value: new Date().toLocaleString(), 
            inline: true 
          }
        )
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('📊 Результаты')
            .setStyle(ButtonStyle.Link)
            .setURL(message ? message.url : '')
            .setDisabled(!message)
        );

      await channel.send({
        embeds: [embed],
        components: [row]
      });

      // Уведомляем победителей в ЛС
      for (const winnerId of winners) {
        try {
          const user = await client.users.fetch(winnerId);
          await user.send({
            content: `🎉 Поздравляем! Вы выиграли розыгрыш **"${giveaway.prize}"**!`
          });
        } catch (error) {
          // Если у пользователя закрыты ЛС
        }
      }

      // Обновляем оригинальное сообщение
      if (message) {
        const endedContainer = new ContainerBuilder()
          .setAccentColor(0xFFD700)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('🏆 **РОЗЫГРЫШ ЗАВЕРШЕН** 🏆'),
            new TextDisplayBuilder().setContent(`🎁 **${giveaway.prize}**`),
            new TextDisplayBuilder().setContent(`👑 Победители: ${winners.length > 0 ? winners.map((w: string) => `<@${w}>`).join(', ') : 'Нет участников'}`)
          );

        await message.edit({
          components: [endedContainer],
          flags: MessageFlags.IsComponentsV2
        });
      }

      logger.info(`Розыгрыш #${giveaway.id} завершен. Победители: ${winners.join(', ')}`);
    }

  } catch (error) {
    console.error(`Ошибка завершения розыгрыша #${giveaway.id}:`, error);
  }
}

// Построение меню розыгрыша (Components V2)
function buildGiveawayContainer(prize: string, winnersCount: number, endAt: Date, description?: string) {
  const peachColor = 0xFFB07C;
  const now = new Date();
  const timeLeft = endAt.getTime() - now.getTime();
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

  const container = new ContainerBuilder()
    .setAccentColor(peachColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🎁 **РОЗЫГРЫШ** 🎁'),
      new TextDisplayBuilder().setContent(`**Приз:** ${prize}`),
      new TextDisplayBuilder().setContent(`**Количество победителей:** ${winnersCount}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

  if (description) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Описание:**\n${description}`)
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`⏰ **Осталось времени:** ${hours}ч ${minutes}м`),
    new TextDisplayBuilder().setContent('🎉 **Нажмите на реакцию 🎉, чтобы участвовать!**')
  );

  return container;
}

// ------ КОМАНДЫ ------

// Создание розыгрыша
export const giveawayCreateCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('розыгрыш-создать')
    .setDescription('[ADMIN] Создать розыгрыш')
    .addStringOption(opt =>
      opt
        .setName('приз')
        .setDescription('Что разыгрывается')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt
        .setName('победители')
        .setDescription('Количество победителей')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10)
    )
    .addIntegerOption(opt =>
      opt
        .setName('часы')
        .setDescription('Длительность в часах')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(168)
    )
    .addStringOption(opt =>
      opt
        .setName('описание')
        .setDescription('Описание розыгрыша (необязательно)')
        .setRequired(false)
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

      const prize = interaction.options.getString('приз', true);
      const winnersCount = interaction.options.getInteger('победители', true);
      const durationHours = interaction.options.getInteger('часы', true);
      const description = interaction.options.getString('описание') || undefined;

      const channel = interaction.channel;
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        await interaction.reply({ content: '❌ Эта команда работает только в текстовых каналах', ephemeral: true });
        return;
      }

      // Создаем розыгрыш в БД
      const { giveawayId, endAt } = await createGiveaway(
        interaction,
        prize,
        winnersCount,
        durationHours,
        description || ''
      );

      // Создаем контейнер
      const container = buildGiveawayContainer(prize, winnersCount, endAt, description);

      // Отправляем сообщение
      const message = await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

      // Добавляем реакцию для участия
      await message.react('🎉');

      // Сохраняем ID сообщения в БД
      await db.run(
        `UPDATE giveaways SET channel_id = ?, message_id = ? WHERE id = ?`,
        [channel.id, message.id, giveawayId]
      );

      await interaction.reply({
        content: `✅ Розыгрыш **"${prize}"** создан! Участвуйте, нажимая на реакцию 🎉`,
        ephemeral: true
      });

      logger.info(`Розыгрыш #${giveawayId} создан: ${prize}`);

    } catch (error) {
      console.error('Ошибка в giveawayCreateCommand:', error);
      await interaction.reply({ content: '❌ Ошибка при создании розыгрыша', ephemeral: true });
    }
  }
};

// Список активных розыгрышей
export const giveawayListCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('розыгрыш-список')
    .setDescription('Показать список активных розыгрышей') as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (!db) {
        await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
        return;
      }

      const giveaways = await db.all(
        `SELECT * FROM giveaways WHERE ended = 0 ORDER BY end_at ASC`
      );

      if (giveaways.length === 0) {
        await interaction.reply({
          content: '📭 Активных розыгрышей нет',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🎁 Активные розыгрыши')
        .setColor('#FFB07C')
        .setDescription(`Всего активных розыгрышей: ${giveaways.length}`)
        .setTimestamp();

      for (const g of giveaways) {
        const endAt = new Date(g.end_at);
        const now = new Date();
        const timeLeft = endAt.getTime() - now.getTime();
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

        embed.addFields({
          name: `#${g.id} - ${g.prize}`,
          value: `👑 Победителей: ${g.winners_count}\n⏰ Осталось: ${hours}ч ${minutes}м`,
          inline: false
        });
      }

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Ошибка в giveawayListCommand:', error);
      await interaction.reply({ content: '❌ Ошибка при получении списка', ephemeral: true });
    }
  }
};

// Завершение розыгрыша вручную
export const giveawayEndCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('розыгрыш-завершить')
    .setDescription('[ADMIN] Завершить розыгрыш досрочно')
    .addIntegerOption(opt =>
      opt
        .setName('id')
        .setDescription('ID розыгрыша')
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

      const giveawayId = interaction.options.getInteger('id', true);

      const giveaway = await getGiveaway(giveawayId);
      if (!giveaway) {
        await interaction.reply({ content: '❌ Розыгрыш не найден', ephemeral: true });
        return;
      }

      if (giveaway.ended === 1) {
        await interaction.reply({ content: '❌ Этот розыгрыш уже завершен', ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `🔄 Завершаю розыгрыш #${giveawayId}...`,
        ephemeral: true
      });

      await endGiveaway(interaction.client, giveaway);

      await interaction.editReply({
        content: `✅ Розыгрыш #${giveawayId} завершен!`
      });

    } catch (error) {
      console.error('Ошибка в giveawayEndCommand:', error);
      await interaction.reply({ content: '❌ Ошибка при завершении розыгрыша', ephemeral: true });
    }
  }
};