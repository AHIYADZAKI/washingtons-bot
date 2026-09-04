"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
class StatsModule {
    constructor() {
        this.db = null;
        this.voiceTimers = new Map();
        this.weekDays = 7;
        this.botStartTime = new Date();
    }
    setDatabase(db) {
        this.db = db;
    }
    // Обработка сообщений
    async handleMessage(message) {
        if (!this.db || message.author.bot)
            return;
        const userId = message.author.id;
        const now = new Date();
        try {
            await this.db.run(`
        INSERT INTO user_stats (user_id, total_messages, last_activity)
        VALUES (?, 1, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          total_messages = total_messages + 1,
          weekly_messages = weekly_messages + 1,
          last_activity = ?
      `, [userId, now.toISOString(), now.toISOString()]);
            await this.updateWeeklyStats(userId, 'messages', 1);
        }
        catch (error) {
            logger_1.logger.error('Error updating message stats:', error);
        }
    }
    // Обработка голосовых каналов
    async handleVoiceStateUpdate(oldState, newState) {
        if (!this.db)
            return;
        const userId = newState.member?.user.id || oldState.member?.user.id;
        if (!userId)
            return;
        // Пользователь зашел в голосовой канал
        if (!oldState.channelId && newState.channelId) {
            this.voiceTimers.set(userId, Date.now());
            logger_1.logger.info(`🎤 ${newState.member?.user.username} зашел в голосовой канал`);
        }
        // Пользователь вышел из голосового канала
        if (oldState.channelId && !newState.channelId) {
            const startTime = this.voiceTimers.get(userId);
            if (startTime) {
                const durationMinutes = Math.floor((Date.now() - startTime) / 60000);
                if (durationMinutes > 0) {
                    logger_1.logger.info(`🎤 ${oldState.member?.user.username} вышел из голосового, пробыл ${durationMinutes} минут`);
                    await this.addVoiceTime(userId, durationMinutes);
                }
                else {
                    logger_1.logger.info(`🎤 ${oldState.member?.user.username} вышел из голосового, пробыл меньше минуты`);
                }
                this.voiceTimers.delete(userId);
            }
        }
    }
    // Добавление времени в голосовом канале
    async addVoiceTime(userId, minutes) {
        if (!this.db)
            return;
        try {
            const now = new Date();
            logger_1.logger.info(`💾 Сохраняем ${minutes} минут для пользователя ${userId}`);
            await this.db.run(`
        INSERT INTO user_stats (user_id, total_voice_minutes, last_activity)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          total_voice_minutes = total_voice_minutes + ?,
          weekly_voice_minutes = weekly_voice_minutes + ?,
          last_activity = ?
      `, [userId, minutes, now.toISOString(), minutes, minutes, now.toISOString()]);
            await this.updateWeeklyStats(userId, 'voice', minutes);
            // Проверяем, что сохранилось
            const check = await this.db.get(`SELECT total_voice_minutes FROM user_stats WHERE user_id = ?`, [userId]);
            logger_1.logger.info(`✅ После сохранения: у пользователя ${userId} ${check?.total_voice_minutes || 0} минут`);
        }
        catch (error) {
            logger_1.logger.error('Error updating voice stats:', error);
        }
    }
    // Обновление недельной статистики
    async updateWeeklyStats(userId, type, amount) {
        if (!this.db)
            return;
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        try {
            const existing = await this.db.get(`SELECT * FROM weekly_stats 
         WHERE user_id = ? AND week_start >= ? AND week_end <= ?`, [userId, weekStart.toISOString(), weekEnd.toISOString()]);
            if (existing) {
                const field = type === 'messages' ? 'messages' : 'voice_minutes';
                await this.db.run(`UPDATE weekly_stats SET ${field} = ${field} + ? WHERE id = ?`, [amount, existing.id]);
            }
            else {
                await this.db.run(`INSERT INTO weekly_stats (user_id, messages, voice_minutes, week_start, week_end)
           VALUES (?, ?, ?, ?, ?)`, [userId, type === 'messages' ? amount : 0, type === 'voice' ? amount : 0, weekStart.toISOString(), weekEnd.toISOString()]);
            }
        }
        catch (error) {
            logger_1.logger.error('Error updating weekly stats:', error);
        }
    }
    // Получение статистики пользователя
    async getUserStats(userId) {
        if (!this.db)
            return null;
        try {
            const stats = await this.db.get(`SELECT * FROM user_stats WHERE user_id = ?`, [userId]);
            const weekly = await this.db.get(`SELECT * FROM weekly_stats WHERE user_id = ? ORDER BY week_start DESC LIMIT 1`, [userId]);
            return { ...stats, weekly };
        }
        catch (error) {
            logger_1.logger.error('Error getting user stats:', error);
            return null;
        }
    }
    // Получение топ-10 пользователей по сообщениям
    async getTopUsersByMessages(limit = 10) {
        if (!this.db)
            return [];
        try {
            return await this.db.all(`SELECT user_id, total_messages, total_voice_minutes 
         FROM user_stats 
         WHERE total_messages > 0 
         ORDER BY total_messages DESC 
         LIMIT ?`, [limit]);
        }
        catch (error) {
            logger_1.logger.error('Error getting top users:', error);
            return [];
        }
    }
    // Получение топ-10 по голосовому времени
    async getTopUsersByVoice(limit = 10) {
        if (!this.db)
            return [];
        try {
            return await this.db.all(`SELECT user_id, total_voice_minutes, total_messages 
         FROM user_stats 
         WHERE total_voice_minutes > 0 
         ORDER BY total_voice_minutes DESC 
         LIMIT ?`, [limit]);
        }
        catch (error) {
            logger_1.logger.error('Error getting top voice users:', error);
            return [];
        }
    }
    // Создание embed со статистикой
    async createStatsEmbed(userId) {
        const stats = await this.getUserStats(userId);
        if (!stats)
            return null;
        const totalMessages = stats.total_messages || 0;
        const totalVoiceMinutes = stats.total_voice_minutes || 0;
        const weeklyMessages = stats.weekly_messages || 0;
        const weeklyVoiceMinutes = stats.weekly_voice_minutes || 0;
        const totalHours = Math.floor(totalVoiceMinutes / 60);
        const totalMinutes = totalVoiceMinutes % 60;
        const weeklyHours = Math.floor(weeklyVoiceMinutes / 60);
        const weeklyMinutes = weeklyVoiceMinutes % 60;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('📊 Статистика пользователя')
            .setColor('#FFB07C')
            .setTimestamp()
            .addFields({
            name: '📝 Сообщения',
            value: `**Всего:** ${totalMessages}\n**За неделю:** ${weeklyMessages}`,
            inline: true
        }, {
            name: '🎤 Время в голосовых',
            value: `**Всего:** ${totalHours}ч ${totalMinutes}м\n**За неделю:** ${weeklyHours}ч ${weeklyMinutes}м`,
            inline: true
        }, {
            name: '📅 Активность',
            value: `**Последняя активность:** ${new Date(stats.last_activity).toLocaleDateString()}`,
            inline: false
        });
        return embed;
    }
    // Создание embed с топ-10
    async createTopEmbed(type) {
        if (!this.db)
            return null;
        try {
            let users;
            let title;
            if (type === 'messages') {
                users = await this.getTopUsersByMessages(10);
                title = '📊 Топ-10 по сообщениям';
            }
            else {
                users = await this.getTopUsersByVoice(10);
                title = '📊 Топ-10 по голосовому времени';
            }
            if (!users || users.length === 0) {
                return null;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(title)
                .setColor('#FFB07C')
                .setTimestamp();
            let description = '';
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const value = type === 'messages' ? user.total_messages : user.total_voice_minutes;
                const hours = type === 'voice' ? Math.floor(value / 60) : 0;
                const minutes = type === 'voice' ? value % 60 : 0;
                const displayValue = type === 'messages'
                    ? `${value} сообщений`
                    : `${hours}ч ${minutes}м (${value} мин)`;
                description += `**${i + 1}.** <@${user.user_id}> - ${displayValue}\n`;
            }
            embed.setDescription(description);
            return embed;
        }
        catch (error) {
            logger_1.logger.error('Error creating top embed:', error);
            return null;
        }
    }
    // Проверка на неактивность (только через 7 дней после запуска бота)
    async checkInactiveUsers(guildId, familyRoleId, inactiveRoleId) {
        if (!this.db)
            return;
        const now = new Date();
        const daysSinceStart = Math.floor((now.getTime() - this.botStartTime.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceStart < 7) {
            logger_1.logger.info(`⏳ Бот работает ${daysSinceStart} дней. Проверка неактивных начнется через ${7 - daysSinceStart} дней.`);
            return;
        }
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        try {
            const inactiveUsers = await this.db.all(`SELECT user_id FROM user_stats 
         WHERE last_activity < ? 
         AND weekly_messages = 0 
         AND weekly_voice_minutes = 0`, [weekAgo.toISOString()]);
            logger_1.logger.info(`📊 Найдено ${inactiveUsers.length} неактивных пользователей`);
            const guild = await index_1.client.guilds.fetch(guildId);
            const members = await guild.members.fetch();
            let assignedCount = 0;
            for (const user of inactiveUsers) {
                const member = members.get(user.user_id);
                if (member) {
                    if (member.roles.cache.has(familyRoleId)) {
                        try {
                            await member.roles.add(inactiveRoleId);
                            assignedCount++;
                            logger_1.logger.info(`👤 Пользователю ${member.user.tag} выдана роль "Инактив"`);
                        }
                        catch (error) {
                            logger_1.logger.error(`Ошибка выдачи роли пользователю ${member.user.tag}:`, error);
                        }
                    }
                }
            }
            logger_1.logger.info(`✅ Роль "Инактив" выдана ${assignedCount} пользователям`);
            await this.db.run(`UPDATE user_stats SET weekly_messages = 0, weekly_voice_minutes = 0`);
        }
        catch (error) {
            logger_1.logger.error('Error checking inactive users:', error);
        }
    }
}
const index_1 = require("../../index");
exports.default = new StatsModule();
//# sourceMappingURL=index.js.map