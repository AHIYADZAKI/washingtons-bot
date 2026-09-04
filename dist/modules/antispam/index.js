"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
class AntiSpamModule {
    constructor() {
        this.messageCache = {};
        this.guildSpamTracker = new Map();
        this.maxMessages = 5;
        this.timeWindow = 5000;
        this.similarThreshold = 0.8;
        this.globalSpamThreshold = 3;
        setInterval(() => this.cleanCache(), 10000);
        setInterval(() => this.cleanGuildTracker(), 30000);
    }
    checkSpam(message) {
        const userId = message.author.id;
        const content = message.content.toLowerCase().trim();
        const now = Date.now();
        if (content.length < 3)
            return false;
        if (!this.messageCache[userId]) {
            this.messageCache[userId] = {};
        }
        const userMessages = this.messageCache[userId];
        let spamCount = 0;
        for (const msgId in userMessages) {
            const msg = userMessages[msgId];
            if (now - msg.timestamp < this.timeWindow) {
                if (this.isSimilar(msg.content, content)) {
                    spamCount++;
                }
            }
        }
        const msgKey = `${message.id}`;
        userMessages[msgKey] = {
            content: content,
            timestamp: now,
            count: 0,
            channelId: message.channel.id
        };
        for (const msgId in userMessages) {
            if (this.isSimilar(userMessages[msgId].content, content)) {
                userMessages[msgId].count++;
            }
        }
        if (spamCount >= this.maxMessages) {
            logger_1.logger.warn(`⚠️ Спам обнаружен от ${message.author.tag} в канале ${message.channel.id}`);
            return true;
        }
        return false;
    }
    checkGlobalSpam(message) {
        const userId = message.author.id;
        const content = message.content.toLowerCase().trim();
        const guildId = message.guild?.id;
        if (!guildId)
            return false;
        if (content.length < 3)
            return false;
        if (!this.guildSpamTracker.has(guildId)) {
            this.guildSpamTracker.set(guildId, {});
        }
        const guildTracker = this.guildSpamTracker.get(guildId);
        const channelId = message.channel.id;
        if (!guildTracker[channelId]) {
            guildTracker[channelId] = {
                messages: [],
                lastMessageTime: Date.now(),
                count: 0
            };
        }
        const channelData = guildTracker[channelId];
        const now = Date.now();
        let similarChannels = 0;
        for (const [chId, data] of Object.entries(guildTracker)) {
            if (chId === channelId)
                continue;
            for (const msg of data.messages) {
                if (this.isSimilar(msg, content) && (now - data.lastMessageTime) < 10000) {
                    similarChannels++;
                    break;
                }
            }
        }
        channelData.messages.push(content);
        if (channelData.messages.length > 10) {
            channelData.messages.shift();
        }
        channelData.lastMessageTime = now;
        channelData.count++;
        if (similarChannels >= this.globalSpamThreshold) {
            logger_1.logger.warn(`🚨 ОБНАРУЖЕН ВЗЛОМ! Пользователь ${message.author.tag} отправил одинаковые сообщения в ${similarChannels + 1} каналов`);
            return true;
        }
        return false;
    }
    isSimilar(str1, str2) {
        if (str1 === str2)
            return true;
        if (str1.length < 10 || str2.length < 10) {
            return str1 === str2;
        }
        const similarity = this.calculateSimilarity(str1, str2);
        return similarity >= this.similarThreshold;
    }
    calculateSimilarity(str1, str2) {
        const words1 = str1.split(' ');
        const words2 = str2.split(' ');
        let commonWords = 0;
        for (const word of words1) {
            if (words2.includes(word)) {
                commonWords++;
            }
        }
        const totalWords = Math.max(words1.length, words2.length);
        return totalWords > 0 ? commonWords / totalWords : 0;
    }
    cleanCache() {
        const now = Date.now();
        const expiredTime = 10000;
        for (const userId in this.messageCache) {
            const userMessages = this.messageCache[userId];
            for (const msgId in userMessages) {
                if (now - userMessages[msgId].timestamp > expiredTime) {
                    delete userMessages[msgId];
                }
            }
            if (Object.keys(userMessages).length === 0) {
                delete this.messageCache[userId];
            }
        }
    }
    cleanGuildTracker() {
        const now = Date.now();
        const expiredTime = 30000;
        for (const [guildId, tracker] of this.guildSpamTracker) {
            for (const [channelId, data] of Object.entries(tracker)) {
                if (now - data.lastMessageTime > expiredTime) {
                    delete tracker[channelId];
                }
            }
            if (Object.keys(tracker).length === 0) {
                this.guildSpamTracker.delete(guildId);
            }
        }
    }
    async handleSpam(message) {
        if (message.author.bot)
            return;
        const isGlobalSpam = this.checkGlobalSpam(message);
        const isSpam = this.checkSpam(message);
        if (isGlobalSpam || isSpam) {
            try {
                await message.delete();
                const warningEmbed = new discord_js_1.EmbedBuilder()
                    .setTitle('⚠️ Обнаружен спам!')
                    .setColor('#FF4444')
                    .setDescription(`**${message.author.username}**, ваше сообщение было удалено за спам!`)
                    .addFields({ name: '📋 Причина', value: isGlobalSpam ? 'Массовая рассылка (возможный взлом)' : 'Повторяющиеся сообщения', inline: false }, { name: '📅 Время', value: new Date().toLocaleString(), inline: true })
                    .setTimestamp()
                    .setFooter({ text: 'Система анти-спам', iconURL: message.guild?.iconURL() || undefined });
                if (message.channel.isTextBased() && !message.channel.isDMBased()) {
                    const warningMessage = await message.channel.send({
                        embeds: [warningEmbed]
                    });
                    setTimeout(async () => {
                        try {
                            await warningMessage.delete();
                        }
                        catch (error) {
                            // Игнорируем ошибки удаления
                        }
                    }, 5000);
                }
                try {
                    const dmEmbed = new discord_js_1.EmbedBuilder()
                        .setTitle('⚠️ Вы были замечены в спаме!')
                        .setColor('#FF4444')
                        .setDescription('Ваши сообщения были удалены за нарушение правил.')
                        .addFields({ name: '📋 Причина', value: isGlobalSpam ? 'Массовая рассылка (возможный взлом)' : 'Повторяющиеся сообщения', inline: false }, { name: '⚠️ Предупреждение', value: 'Продолжение спама приведет к блокировке!', inline: false })
                        .setTimestamp();
                    await message.author.send({ embeds: [dmEmbed] });
                }
                catch (error) {
                    // Если у пользователя закрыты ЛС
                }
                logger_1.logger.info(`✅ Удалено спам-сообщение от ${message.author.tag} в канале ${message.channel.id} (Глобальный: ${isGlobalSpam})`);
            }
            catch (error) {
                logger_1.logger.error('❌ Ошибка при удалении спам-сообщения:', error);
            }
        }
    }
}
exports.default = new AntiSpamModule();
//# sourceMappingURL=index.js.map