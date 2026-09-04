"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaListCommand = exports.youtubeNotificationCommand = exports.youtubeDeleteCommand = exports.youtubeAddCommand = exports.twitchNotificationCommand = exports.twitchDeleteCommand = exports.twitchAddCommand = void 0;
exports.setMediaDB = setMediaDB;
exports.checkMediaStatus = checkMediaStatus;
const discord_js_1 = require("discord.js");
const logger_1 = require("../utils/logger");
const axios_1 = __importDefault(require("axios"));
const querystring_1 = __importDefault(require("querystring"));
let db = null;
// Чтение ключей из .env
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
let twitchAccessToken = null;
let twitchTokenExpiry = 0;
function setMediaDB(database) {
    db = database;
}
// ------ TWITCH API ------
async function getTwitchToken() {
    if (twitchAccessToken && Date.now() < twitchTokenExpiry) {
        return twitchAccessToken;
    }
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
        throw new Error('TWITCH_CLIENT_ID и TWITCH_CLIENT_SECRET не настроены в .env');
    }
    const response = await axios_1.default.post('https://id.twitch.tv/oauth2/token', querystring_1.default.stringify({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
    });
    twitchAccessToken = response.data.access_token;
    twitchTokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return twitchAccessToken;
}
async function getTwitchUser(username) {
    const token = await getTwitchToken();
    const response = await axios_1.default.get('https://api.twitch.tv/helix/users', {
        headers: {
            'Client-ID': TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
        },
        params: { login: username },
        timeout: 15000
    });
    return response.data.data[0] || null;
}
// ------ YOUTUBE API ------
async function searchYouTubeChannel(query) {
    if (!YOUTUBE_API_KEY)
        throw new Error('YOUTUBE_API_KEY не настроен в .env');
    const response = await axios_1.default.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
            part: 'snippet',
            q: query,
            type: 'channel',
            maxResults: 1,
            key: YOUTUBE_API_KEY
        },
        timeout: 15000
    });
    return response.data.items[0] || null;
}
async function getYouTubeChannel(channelId) {
    if (!YOUTUBE_API_KEY)
        throw new Error('YOUTUBE_API_KEY не настроен в .env');
    const response = await axios_1.default.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
            part: 'snippet,statistics',
            id: channelId,
            key: YOUTUBE_API_KEY
        },
        timeout: 15000
    });
    return response.data.items[0] || null;
}
// ------ КОМАНДЫ ------
exports.twitchAddCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('twitch-add')
        .setDescription('[ADMIN] Добавить стримера для отслеживания')
        .addStringOption(opt => opt.setName('username').setDescription('Имя пользователя на Twitch').setRequired(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('Канал для уведомлений').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Сообщение при начале стрима (используйте {username})').setRequired(false))
        .addRoleOption(opt => opt.setName('role').setDescription('Роль для выдачи при стриме').setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        console.log('✅ twitchAdd: deferReply');
        if (!interaction.isChatInputCommand()) {
            await interaction.editReply('❌ Ошибка типа команды');
            return;
        }
        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.editReply('❌ У вас нет прав администратора!');
            return;
        }
        if (!db) {
            await interaction.editReply('❌ База данных не инициализирована');
            return;
        }
        const username = interaction.options.getString('username', true).toLowerCase();
        const channel = interaction.options.getChannel('channel', true);
        const message = interaction.options.getString('message') || '{username} начал стрим! Заходите! 🎮';
        const role = interaction.options.getRole('role');
        try {
            console.log(`🔄 Проверяем пользователя ${username} на Twitch...`);
            const userData = await getTwitchUser(username);
            if (!userData) {
                await interaction.editReply(`❌ Пользователь **${username}** не найден на Twitch`);
                return;
            }
            console.log(`✅ Пользователь ${username} найден`);
            const existing = await db.get(`SELECT * FROM twitch_streamers WHERE username = ?`, [username]);
            if (existing) {
                await interaction.editReply(`❌ Стример **${username}** уже отслеживается`);
                return;
            }
            await db.run(`INSERT INTO twitch_streamers (username, notification_channel, notification_message, role_id) VALUES (?, ?, ?, ?)`, [username, channel.id, message, role?.id || null]);
            console.log(`✅ Стример ${username} добавлен в БД`);
            await interaction.editReply(`✅ Стример **${username}** добавлен!\n📢 Канал уведомлений: ${channel.toString()}\n${role ? `🎭 Роль: ${role.toString()}` : ''}`);
            logger_1.logger.info(`Twitch стример ${username} добавлен`);
        }
        catch (error) {
            console.error('❌ Ошибка в twitchAdd:', error);
            await interaction.editReply(`❌ Ошибка: ${error.message}`);
        }
    }
};
exports.twitchDeleteCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('twitch-delete')
        .setDescription('[ADMIN] Удалить стримера из отслеживания')
        .addStringOption(opt => opt.setName('username').setDescription('Имя пользователя на Twitch').setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.isChatInputCommand())
            return;
        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.editReply('❌ У вас нет прав администратора!');
            return;
        }
        if (!db) {
            await interaction.editReply('❌ База данных не инициализирована');
            return;
        }
        const username = interaction.options.getString('username', true).toLowerCase();
        try {
            const result = await db.run(`DELETE FROM twitch_streamers WHERE username = ?`, [username]);
            if (result.changes && result.changes > 0) {
                await interaction.editReply(`✅ Стример **${username}** удален из отслеживания`);
                logger_1.logger.info(`Twitch стример ${username} удален`);
            }
            else {
                await interaction.editReply(`❌ Стример **${username}** не найден`);
            }
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Ошибка: ${error.message}`);
        }
    }
};
exports.twitchNotificationCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('twitch-notification')
        .setDescription('[ADMIN] Настроить уведомления для стримера')
        .addStringOption(opt => opt.setName('username').setDescription('Имя пользователя на Twitch').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Новое сообщение (используйте {username})').setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.isChatInputCommand())
            return;
        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.editReply('❌ У вас нет прав администратора!');
            return;
        }
        if (!db) {
            await interaction.editReply('❌ База данных не инициализирована');
            return;
        }
        const username = interaction.options.getString('username', true).toLowerCase();
        const message = interaction.options.getString('message', true);
        try {
            const result = await db.run(`UPDATE twitch_streamers SET notification_message = ? WHERE username = ?`, [message, username]);
            if (result.changes && result.changes > 0) {
                await interaction.editReply(`✅ Сообщение для **${username}** обновлено!`);
                logger_1.logger.info(`Twitch уведомление для ${username} обновлено`);
            }
            else {
                await interaction.editReply(`❌ Стример **${username}** не найден`);
            }
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Ошибка: ${error.message}`);
        }
    }
};
// ------ YOUTUBE КОМАНДЫ ------
exports.youtubeAddCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('youtube-add')
        .setDescription('[ADMIN] Добавить YouTube канал для отслеживания')
        .addStringOption(opt => opt.setName('channel').setDescription('Название канала или ID канала').setRequired(true))
        .addChannelOption(opt => opt.setName('notification_channel').setDescription('Канал для уведомлений').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Сообщение при новом видео (используйте {channel})').setRequired(false))
        .addRoleOption(opt => opt.setName('role').setDescription('Роль для выдачи при новом видео').setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.isChatInputCommand())
            return;
        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.editReply('❌ У вас нет прав администратора!');
            return;
        }
        if (!db) {
            await interaction.editReply('❌ База данных не инициализирована');
            return;
        }
        const query = interaction.options.getString('channel', true);
        const channel = interaction.options.getChannel('notification_channel', true);
        const message = interaction.options.getString('message') || 'Новое видео на канале {channel}! 🎬';
        const role = interaction.options.getRole('role');
        try {
            let channelData = await searchYouTubeChannel(query);
            let channelId, channelName;
            if (channelData) {
                channelId = channelData.id.channelId;
                channelName = channelData.snippet.channelTitle;
            }
            else {
                const directChannel = await getYouTubeChannel(query);
                if (directChannel) {
                    channelId = query;
                    channelName = directChannel.snippet.title;
                }
                else {
                    await interaction.editReply(`❌ Канал **${query}** не найден на YouTube`);
                    return;
                }
            }
            const existing = await db.get(`SELECT * FROM youtube_creators WHERE channel_id = ?`, [channelId]);
            if (existing) {
                await interaction.editReply(`❌ Канал **${channelName}** уже отслеживается`);
                return;
            }
            await db.run(`INSERT INTO youtube_creators (channel_id, channel_name, notification_channel, notification_message, role_id) VALUES (?, ?, ?, ?, ?)`, [channelId, channelName, channel.id, message, role?.id || null]);
            await interaction.editReply(`✅ YouTube канал **${channelName}** добавлен!\n📢 Канал уведомлений: ${channel.toString()}\n${role ? `🎭 Роль: ${role.toString()}` : ''}`);
            logger_1.logger.info(`YouTube канал ${channelName} добавлен`);
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Ошибка: ${error.message}`);
        }
    }
};
exports.youtubeDeleteCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('youtube-delete')
        .setDescription('[ADMIN] Удалить YouTube канал из отслеживания')
        .addStringOption(opt => opt.setName('channel').setDescription('Название канала').setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.isChatInputCommand())
            return;
        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.editReply('❌ У вас нет прав администратора!');
            return;
        }
        if (!db) {
            await interaction.editReply('❌ База данных не инициализирована');
            return;
        }
        const channelName = interaction.options.getString('channel', true);
        try {
            const result = await db.run(`DELETE FROM youtube_creators WHERE channel_name = ? OR channel_id = ?`, [channelName, channelName]);
            if (result.changes && result.changes > 0) {
                await interaction.editReply(`✅ YouTube канал **${channelName}** удален из отслеживания`);
                logger_1.logger.info(`YouTube канал ${channelName} удален`);
            }
            else {
                await interaction.editReply(`❌ YouTube канал **${channelName}** не найден`);
            }
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Ошибка: ${error.message}`);
        }
    }
};
exports.youtubeNotificationCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('youtube-notification')
        .setDescription('[ADMIN] Настроить уведомления для YouTube канала')
        .addStringOption(opt => opt.setName('channel').setDescription('Название канала').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Новое сообщение (используйте {channel})').setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.isChatInputCommand())
            return;
        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.editReply('❌ У вас нет прав администратора!');
            return;
        }
        if (!db) {
            await interaction.editReply('❌ База данных не инициализирована');
            return;
        }
        const channelName = interaction.options.getString('channel', true);
        const message = interaction.options.getString('message', true);
        try {
            const result = await db.run(`UPDATE youtube_creators SET notification_message = ? WHERE channel_name = ? OR channel_id = ?`, [message, channelName, channelName]);
            if (result.changes && result.changes > 0) {
                await interaction.editReply(`✅ Сообщение для **${channelName}** обновлено!`);
                logger_1.logger.info(`YouTube уведомление для ${channelName} обновлено`);
            }
            else {
                await interaction.editReply(`❌ YouTube канал **${channelName}** не найден`);
            }
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Ошибка: ${error.message}`);
        }
    }
};
exports.mediaListCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('media-list')
        .setDescription('Показать список отслеживаемых стримеров и блогеров'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.isChatInputCommand())
            return;
        if (!db) {
            await interaction.editReply('❌ База данных не инициализирована');
            return;
        }
        try {
            const twitchStreamers = await db.all(`SELECT * FROM twitch_streamers ORDER BY username`);
            const youtubeCreators = await db.all(`SELECT * FROM youtube_creators ORDER BY channel_name`);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📺 Отслеживаемые медиа')
                .setColor('#FFB07C')
                .setTimestamp();
            if (twitchStreamers.length > 0) {
                embed.addFields({
                    name: '🎮 Twitch стримеры',
                    value: twitchStreamers.map((s) => `• **${s.username}**`).join('\n'),
                    inline: false
                });
            }
            if (youtubeCreators.length > 0) {
                embed.addFields({
                    name: '🎬 YouTube блогеры',
                    value: youtubeCreators.map((c) => `• **${c.channel_name}**`).join('\n'),
                    inline: false
                });
            }
            if (twitchStreamers.length === 0 && youtubeCreators.length === 0) {
                embed.setDescription('📭 Нет отслеживаемых медиа');
            }
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Ошибка: ${error.message}`);
        }
    }
};
// ------ ПРОВЕРКА СТАТУСА (запускается каждую минуту) ------
async function checkTwitchStreamer(username) {
    const token = await getTwitchToken();
    const response = await axios_1.default.get('https://api.twitch.tv/helix/streams', {
        headers: {
            'Client-ID': TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
        },
        params: { user_login: username },
        timeout: 15000
    });
    return response.data.data[0] || null;
}
async function checkYouTubeChannel(channelId) {
    if (!YOUTUBE_API_KEY)
        throw new Error('YOUTUBE_API_KEY не настроен в .env');
    const response = await axios_1.default.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
            part: 'snippet',
            channelId: channelId,
            order: 'date',
            maxResults: 1,
            key: YOUTUBE_API_KEY
        },
        timeout: 15000
    });
    return response.data.items[0] || null;
}
async function sendTwitchNotification(client, streamer, stream) {
    const channel = client.channels.cache.get(streamer.notification_channel);
    if (!channel || !channel.isTextBased())
        return;
    const message = streamer.notification_message
        .replace(/{username}/g, streamer.username)
        .replace(/{title}/g, stream.title || 'Без названия')
        .replace(/{game}/g, stream.game_name || 'Неизвестная игра')
        .replace(/{viewers}/g, stream.viewer_count || 0);
    const roleMention = streamer.role_id ? `<@&${streamer.role_id}>` : '';
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🎮 ${streamer.username} начал стрим!`)
        .setColor('#9146FF')
        .setDescription(stream.title || 'Без названия')
        .addFields({ name: '🎮 Игра', value: stream.game_name || 'Неизвестная игра', inline: true }, { name: '👀 Зрителей', value: `${stream.viewer_count || 0}`, inline: true })
        .setImage(stream.thumbnail_url?.replace('{width}', '1920').replace('{height}', '1080') || null)
        .setURL(`https://twitch.tv/${streamer.username}`)
        .setTimestamp();
    await channel.send({ content: `${roleMention} ${message}`, embeds: [embed] });
    logger_1.logger.info(`Уведомление о стриме ${streamer.username} отправлено`);
}
async function sendYouTubeNotification(client, creator, video) {
    const channel = client.channels.cache.get(creator.notification_channel);
    if (!channel || !channel.isTextBased())
        return;
    const videoId = video.id.videoId;
    const videoTitle = video.snippet.title;
    const videoUrl = `https://youtube.com/watch?v=${videoId}`;
    const thumbnail = video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url;
    const message = creator.notification_message
        .replace(/{channel}/g, creator.channel_name)
        .replace(/{title}/g, videoTitle);
    const roleMention = creator.role_id ? `<@&${creator.role_id}>` : '';
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🎬 Новое видео на канале ${creator.channel_name}!`)
        .setColor('#FF0000')
        .setDescription(videoTitle)
        .addFields({ name: '📹 Ссылка', value: `[Смотреть видео](${videoUrl})` })
        .setImage(thumbnail)
        .setURL(videoUrl)
        .setTimestamp();
    await channel.send({ content: `${roleMention} ${message}`, embeds: [embed] });
    logger_1.logger.info(`Уведомление о новом видео ${creator.channel_name} отправлено`);
}
async function checkMediaStatus(client) {
    if (!db)
        return;
    try {
        const twitchStreamers = await db.all(`SELECT * FROM twitch_streamers`);
        for (const streamer of twitchStreamers) {
            try {
                const stream = await checkTwitchStreamer(streamer.username);
                const lastNotified = streamer.last_notified || 0;
                const isLive = stream !== null;
                if (isLive && !lastNotified) {
                    await sendTwitchNotification(client, streamer, stream);
                    await db.run(`UPDATE twitch_streamers SET last_notified = 1, last_stream_id = ? WHERE username = ?`, [stream.id, streamer.username]);
                }
                else if (!isLive && lastNotified) {
                    await db.run(`UPDATE twitch_streamers SET last_notified = 0, last_stream_id = NULL WHERE username = ?`, [streamer.username]);
                }
                else if (isLive && lastNotified) {
                    const currentStreamId = streamer.last_stream_id;
                    if (currentStreamId !== stream.id) {
                        await sendTwitchNotification(client, streamer, stream);
                        await db.run(`UPDATE twitch_streamers SET last_stream_id = ? WHERE username = ?`, [stream.id, streamer.username]);
                    }
                }
            }
            catch (error) {
                console.error(`Ошибка проверки стримера ${streamer.username}:`, error);
            }
        }
        const youtubeCreators = await db.all(`SELECT * FROM youtube_creators`);
        for (const creator of youtubeCreators) {
            try {
                const video = await checkYouTubeChannel(creator.channel_id);
                if (video) {
                    const videoId = video.id.videoId;
                    const lastVideoId = creator.last_video_id;
                    if (videoId !== lastVideoId) {
                        await sendYouTubeNotification(client, creator, video);
                        await db.run(`UPDATE youtube_creators SET last_video_id = ? WHERE channel_id = ?`, [videoId, creator.channel_id]);
                    }
                }
            }
            catch (error) {
                console.error(`Ошибка проверки канала ${creator.channel_name}:`, error);
            }
        }
    }
    catch (error) {
        console.error('Ошибка проверки медиа:', error);
    }
}
//# sourceMappingURL=media.js.map