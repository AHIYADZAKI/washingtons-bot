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
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextChannel,
  DMChannel,
  NewsChannel,
  StageChannel,
  VoiceChannel,
  ThreadChannel,
  Guild,
  CategoryChannel,
  OverwriteType
} from 'discord.js';
import { Command } from './index';
import { Database } from 'sqlite';
import { logger } from '../utils/logger';

let db: Database | null = null;
let applicationCounter = 1;

// ID категории для заявок (нужно заменить на ваш)
const CATEGORY_ID = '1532673062510788779'; // <-- СЮДА ВСТАВИТЬ ID КАТЕГОРИИ

export function setFamilyDB(database: Database) {
  db = database;
  loadLastApplicationNumber();
}

async function loadLastApplicationNumber() {
  if (!db) return;
  try {
    const result = await db.get(`SELECT MAX(id) as max_id FROM family_applications`);
    if (result && result.max_id) {
      applicationCounter = result.max_id + 1;
    }
  } catch (error) {
    console.error('Ошибка загрузки номера заявки:', error);
  }
}

function isSendableChannel(channel: any): channel is TextChannel | NewsChannel | StageChannel | VoiceChannel | ThreadChannel | DMChannel {
  if (!channel) return false;
  if (typeof channel.send !== 'function') return false;
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

// Создание анкеты для заявки (Components V2)
async function buildApplicationForm(interaction: CommandInteraction | ButtonInteraction) {
  const peachColor = 0xFFB07C;

  const container = new ContainerBuilder()
    .setAccentColor(peachColor)
    .addMediaGalleryComponents(
      new MediaGalleryBuilder()
        .addItems(
          new MediaGalleryItemBuilder()
            .setURL('https://media.discordapp.net/attachments/1099441518479147150/1404943669299118119/f2db47d6e9f225b2.png?ex=6a6d1741&is=6a6bc5c1&hm=cd057d0ae25174fbdaf8c128650668df8b024b91918fd47658379b3deebf6f45&=&format=webp&quality=lossless&width=2100&height=1312')
        )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('👋 **Заявки в семью Washington\'s**')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🤝 **ТРЕБОВАНИЯ ВСТУПЛЕНИЯ В СЕМЬЮ** 🤝')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('• Адекватность.'),
      new TextDisplayBuilder().setContent('• Умение слушать старший состав семьи.'),
      new TextDisplayBuilder().setContent('• Уважать всех однофамильцев.'),
      new TextDisplayBuilder().setContent('• Воспринимать семью как отдельную фракцию.'),
      new TextDisplayBuilder().setContent('• Смена фамилии.'),
      new TextDisplayBuilder().setContent('• Идти за семьей в любую фракцию.'),
      new TextDisplayBuilder().setContent('• Быть активным участником семьи.'),
      new TextDisplayBuilder().setContent('• Веселиться со всеми!!!')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('⚠️ **Предупреждение!**'),
      new TextDisplayBuilder().setContent('Кто будет ради интереса создавать заявки, будет наказан.')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('family_apply')
        .setLabel('📝 Подать заявку')
        .setStyle(ButtonStyle.Primary)
    );

  container.addActionRowComponents(row);

  return { container };
}

// Получение или создание голосовых каналов в категории
async function getOrCreateVoiceChannels(guild: Guild, categoryId: string) {
  const category = guild.channels.cache.get(categoryId) as CategoryChannel;
  if (!category) {
    throw new Error('Категория не найдена! Укажите правильный ID категории в CATEGORY_ID');
  }

  let waitingChannel = guild.channels.cache.find(
    (ch) => ch.parentId === categoryId && ch.name === 'Ожидание обзвона' && ch.type === ChannelType.GuildVoice
  ) as VoiceChannel;

  let callChannel = guild.channels.cache.find(
    (ch) => ch.parentId === categoryId && ch.name === 'Обзвон' && ch.type === ChannelType.GuildVoice
  ) as VoiceChannel;

  if (!waitingChannel) {
    waitingChannel = await guild.channels.create({
      name: 'Ожидание обзвона',
      type: ChannelType.GuildVoice,
      parent: categoryId,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.Connect],
        },
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.Connect],
        }
      ]
    });
    logger.info('Создан голосовой канал "Ожидание обзвона"');
  }

  if (!callChannel) {
    callChannel = await guild.channels.create({
      name: 'Обзвон',
      type: ChannelType.GuildVoice,
      parent: categoryId,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.Connect],
        },
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.Connect],
        }
      ]
    });
    logger.info('Создан голосовой канал "Обзвон"');
  }

  return { waitingChannel, callChannel };
}

// Отправка заявки в канал (Components V2)
async function sendApplication(interaction: CommandInteraction | ButtonInteraction, answers: any) {
  if (!db) throw new Error('Database not initialized');

  const applicationNumber = applicationCounter++;
  
  await db.run(
    `INSERT INTO family_applications (applicant_id, answers, status) VALUES (?, ?, ?)`,
    [interaction.user.id, JSON.stringify(answers), 'pending']
  );

  const guild = interaction.guild;
  if (!guild) throw new Error('Гильдия не найдена');

  let category = guild.channels.cache.get(CATEGORY_ID) as CategoryChannel;
  if (!category) {
    category = await guild.channels.create({
      name: 'Заявки в семью',
      type: ChannelType.GuildCategory,
    });
    logger.info('Создана категория "Заявки в семью"');
  }

  const { waitingChannel, callChannel } = await getOrCreateVoiceChannels(guild, CATEGORY_ID);

  const channelName = `заявка-№${applicationNumber}`;
  
  const moderatorRole = guild.roles.cache.find(r => r.name === 'Модератор') || 
                        guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.Administrator));

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: CATEGORY_ID,
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

  // Создаем контейнер для заявки (Components V2)
  const peachColor = 0xFFB07C;
  
  const moderatorMention = moderatorRole ? `<@&${moderatorRole.id}>` : '@Модератор';
  const applicantMention = `<@${interaction.user.id}>`;
  
  const container = new ContainerBuilder()
    .setAccentColor(peachColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`📋 **Заявка №${applicationNumber}**`),
      new TextDisplayBuilder().setContent(`👤 **${interaction.user.username}** подает заявку в семью!`),
      new TextDisplayBuilder().setContent(`${applicantMention} ${moderatorMention}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**❓ Почему хотите вступить?**\n${answers.question1 || 'Не указано'}`),
      new TextDisplayBuilder().setContent(`**❓ Ваши навыки и умения?**\n${answers.question2 || 'Не указано'}`),
      new TextDisplayBuilder().setContent(`**❓ Ваш опыт в других семьях?**\n${answers.question3 || 'Не указано'}`),
      new TextDisplayBuilder().setContent(`**❓ Что вы можете дать семье?**\n${answers.question4 || 'Не указано'}`),
      new TextDisplayBuilder().setContent(`**❓ Ваш возраст?**\n${answers.question5 || 'Не указано'}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`🆔 ID: ${interaction.user.id}`)
    );

  // Кнопки модерации (Components V2)
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`family_accept_${applicationNumber}`)
        .setLabel('✅ Принять')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`family_approve_${applicationNumber}`)
        .setLabel('📞 Позвать на обзвон')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`family_reject_${applicationNumber}`)
        .setLabel('❌ Отказать')
        .setStyle(ButtonStyle.Danger)
    );

  container.addActionRowComponents(row);

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });

  await db.run(
    `UPDATE family_applications SET channel_id = ? WHERE id = ?`,
    [channel.id, applicationNumber]
  );

  return { channel, applicationNumber, waitingChannel, callChannel };
}

// ------ КОМАНДЫ ------

export const familyInviteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('familyinvite')
    .setDescription('[ADMIN] Создать меню для заявок в семью') as SlashCommandBuilder,

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

      const { container } = await buildApplicationForm(interaction);
      await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

      await interaction.reply({
        content: '✅ Меню заявок создано!',
        ephemeral: true
      });
    } catch (error) {
      console.error('Ошибка в familyInviteCommand:', error);
      await interaction.reply({ content: '❌ Ошибка при создании меню', ephemeral: true });
    }
  }
};

export async function handleFamilyApply(interaction: ButtonInteraction) {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'family_apply') return;

  try {
    const modal = new ModalBuilder()
      .setCustomId('family_modal')
      .setTitle('📝 Заявка в семью');

    const question1 = new TextInputBuilder()
      .setCustomId('q1')
      .setLabel('Почему хотите вступить?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Опишите свои мотивы...')
      .setRequired(true);

    const question2 = new TextInputBuilder()
      .setCustomId('q2')
      .setLabel('Ваши навыки и умения?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Чем вы можете быть полезны?')
      .setRequired(true);

    const question3 = new TextInputBuilder()
      .setCustomId('q3')
      .setLabel('Опыт в других семьях?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Были ли вы в других семьях?')
      .setRequired(false);

    const question4 = new TextInputBuilder()
      .setCustomId('q4')
      .setLabel('Что вы можете дать семье?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ваш вклад в развитие семьи...')
      .setRequired(true);

    const question5 = new TextInputBuilder()
      .setCustomId('q5')
      .setLabel('Ваш возраст?')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Например: 20')
      .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(question1);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(question2);
    const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(question3);
    const row4 = new ActionRowBuilder<TextInputBuilder>().addComponents(question4);
    const row5 = new ActionRowBuilder<TextInputBuilder>().addComponents(question5);

    modal.addComponents(row1, row2, row3, row4, row5);
    await interaction.showModal(modal);

  } catch (error) {
    console.error('Ошибка в handleFamilyApply:', error);
    await interaction.reply({
      content: '❌ Произошла ошибка при открытии формы',
      ephemeral: true
    });
  }
}

export async function handleFamilyModal(interaction: any) {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId !== 'family_modal') return;

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

  } catch (error) {
    console.error('Ошибка в handleFamilyModal:', error);
    await interaction.editReply({
      content: '❌ Произошла ошибка при отправке заявки'
    });
  }
}

// Обработка кнопок модерации
export async function handleFamilyModeration(interaction: ButtonInteraction) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('family_')) return;
  if (interaction.customId === 'family_apply') return;

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

    const application = await db.get(
      `SELECT * FROM family_applications WHERE id = ?`,
      [applicationNumber]
    );

    if (!application) {
      await interaction.reply({ content: '❌ Заявка не найдена', ephemeral: true });
      return;
    }

    const applicantId = application.applicant_id;
    const answers = JSON.parse(application.answers);

    // --- ПРИНЯТЬ ЗАЯВКУ ---
    if (action === 'accept') {
      // Открываем модальное окно для ввода дня рождения
      const modal = new ModalBuilder()
        .setCustomId(`family_birthday_modal_${applicationNumber}`)
        .setTitle(`🎂 День рождения`);

      const birthdayInput = new TextInputBuilder()
        .setCustomId('birthday_date')
        .setLabel('Дата рождения (ДД/ММ)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например: 15/08')
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(5);

      const row = new ActionRowBuilder<TextInputBuilder>().addComponents(birthdayInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
      return;
    }

    // --- ПОЗВАТЬ НА ОБЗВОН ---
    if (action === 'approve') {
      try {
        const user = await interaction.client.users.fetch(applicantId);
        
        const guild = interaction.guild;
        if (!guild) throw new Error('Гильдия не найдена');
        
        const waitingChannel = guild.channels.cache.find(
          (ch) => ch.parentId === CATEGORY_ID && ch.name === 'Ожидание обзвона' && ch.type === ChannelType.GuildVoice
        ) as VoiceChannel;

        if (!waitingChannel) {
          await interaction.reply({
            content: '❌ Голосовой канал "Ожидание обзвона" не найден!',
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('📞 Вас вызывают на обзвон!')
          .setColor('#00FF88')
          .setDescription(`**${interaction.user.username}** приглашает вас на обзвон по заявке №${applicationNumber}`)
          .addFields(
            { name: '📍 Место', value: `Голосовой канал: **${waitingChannel.name}**` },
            { name: '📝 Инструкция', value: 'Зайдите в голосовой канал и ожидайте модератора.' }
          )
          .setTimestamp();

        await user.send({ embeds: [embed] });
        
        const channel = interaction.channel;
        if (channel && isSendableChannel(channel)) {
          const container = new ContainerBuilder()
            .setAccentColor(0x00FF88)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`📞 **${interaction.user.username}** позвал(а) на обзвон <@${applicantId}>!`),
              new TextDisplayBuilder().setContent(`📍 Голосовой канал: **${waitingChannel.name}**`)
            );

          await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
          });
        }

        await interaction.reply({
          content: `✅ Приглашение на обзвон отправлено!`,
          ephemeral: true
        });

        await db.run(
          `UPDATE family_applications SET status = 'approved' WHERE id = ?`,
          [applicationNumber]
        );

      } catch (error) {
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
      const modal = new ModalBuilder()
        .setCustomId(`family_reject_modal_${applicationNumber}`)
        .setTitle(`❌ Отказ по заявке №${applicationNumber}`);

      const reasonInput = new TextInputBuilder()
        .setCustomId('reject_reason')
        .setLabel('Причина отказа')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Опишите причину отказа...')
        .setRequired(true);

      const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }

  } catch (error) {
    console.error('Ошибка в handleFamilyModeration:', error);
    await interaction.reply({
      content: '❌ Произошла ошибка при обработке заявки',
      ephemeral: true
    });
  }
}

// Обработка модального окна с днем рождения (при принятии)
export async function handleFamilyBirthdayModal(interaction: any) {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith('family_birthday_modal_')) return;

  try {
    const applicationNumber = parseInt(interaction.customId.replace('family_birthday_modal_', ''));
    
    if (!db) {
      await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
      return;
    }

    const application = await db.get(
      `SELECT * FROM family_applications WHERE id = ?`,
      [applicationNumber]
    );

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
    await db.run(
      `INSERT INTO birthdays (user_id, birthday_date) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET birthday_date = ?, updated_at = CURRENT_TIMESTAMP`,
      [applicantId, birthdayDate, birthdayDate]
    );

    logger.info(`День рождения ${birthdayDate} добавлен для пользователя ${applicantId}`);

    // Уведомляем пользователя
    try {
      const user = await interaction.client.users.fetch(applicantId);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Заявка принята!')
        .setColor('#00FF88')
        .setDescription(`Ваша заявка №${applicationNumber} была **принята**!`)
        .addFields(
          { name: '🎉 Поздравляем!', value: 'Добро пожаловать в семью Washington\'s!' },
          { name: '🎂 День рождения', value: birthdayDate, inline: true },
          { name: '📅 Дата', value: new Date().toLocaleString() }
        )
        .setTimestamp();

      await user.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Ошибка отправки уведомления:', error);
    }

    await interaction.reply({
      content: `✅ Заявка №${applicationNumber} принята! День рождения **${birthdayDate}** добавлен в календарь! 🎉`,
      ephemeral: true
    });

    await db.run(
      `UPDATE family_applications SET status = 'accepted' WHERE id = ?`,
      [applicationNumber]
    );

    // Обновляем сообщение в канале (Components V2)
    const channel = interaction.channel;
    if (channel && isSendableChannel(channel)) {
      const container = new ContainerBuilder()
        .setAccentColor(0x00FF88)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`✅ **Заявка №${applicationNumber} ПРИНЯТА**`),
          new TextDisplayBuilder().setContent(`🎉 Поздравляем! Заявка одобрена.`),
          new TextDisplayBuilder().setContent(`🎂 День рождения: **${birthdayDate}**`)
        );

      await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

  } catch (error) {
    console.error('Ошибка в handleFamilyBirthdayModal:', error);
    await interaction.reply({
      content: '❌ Произошла ошибка при обработке дня рождения',
      ephemeral: true
    });
  }
}

// Обработка модального окна с причиной отказа
export async function handleFamilyRejectModal(interaction: any) {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith('family_reject_modal_')) return;

  try {
    const applicationNumber = parseInt(interaction.customId.replace('family_reject_modal_', ''));
    
    if (!db) {
      await interaction.reply({ content: '❌ База данных не инициализирована', ephemeral: true });
      return;
    }

    const application = await db.get(
      `SELECT * FROM family_applications WHERE id = ?`,
      [applicationNumber]
    );

    if (!application) {
      await interaction.reply({ content: '❌ Заявка не найдена', ephemeral: true });
      return;
    }

    const applicantId = application.applicant_id;
    const reason = interaction.fields.getTextInputValue('reject_reason');
    const answers = JSON.parse(application.answers);

    try {
      const user = await interaction.client.users.fetch(applicantId);
      
      const embed = new EmbedBuilder()
        .setTitle('❌ Заявка отклонена')
        .setColor('#FF4444')
        .setDescription(`Ваша заявка №${applicationNumber} была отклонена.`)
        .addFields(
          { name: '📝 Причина отказа', value: reason || 'Не указана' },
          { name: '📅 Дата', value: new Date().toLocaleString() }
        )
        .setTimestamp();

      await user.send({ embeds: [embed] });
      
      await interaction.reply({
        content: `✅ Пользователю отправлено уведомление об отказе!`,
        ephemeral: true
      });

      await db.run(
        `UPDATE family_applications SET status = 'rejected' WHERE id = ?`,
        [applicationNumber]
      );

      const channel = interaction.channel;
      if (channel && isSendableChannel(channel)) {
        const container = new ContainerBuilder()
          .setAccentColor(0xFF4444)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`❌ **Заявка №${applicationNumber} ОТКЛОНЕНА**`),
            new TextDisplayBuilder().setContent(`📝 Причина: ${reason || 'Не указана'}`)
          );

        await channel.send({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
      }

    } catch (error) {
      console.error('Ошибка отправки отказа:', error);
      await interaction.reply({
        content: '❌ Не удалось отправить уведомление пользователю',
        ephemeral: true
      });
    }

  } catch (error) {
    console.error('Ошибка в handleFamilyRejectModal:', error);
    await interaction.reply({
      content: '❌ Произошла ошибка при отправке отказа',
      ephemeral: true
    });
  }
}