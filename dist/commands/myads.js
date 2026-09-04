"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.myAdsCommand = void 0;
const discord_js_1 = require("discord.js");
exports.myAdsCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('моианкеты')
        .setDescription('Управление вашими анкетами'),
    async execute(interaction) {
        try {
            if (!interaction.isChatInputCommand())
                return;
            const messages = await interaction.channel?.messages.fetch({ limit: 100 });
            const userAds = [];
            messages?.forEach(msg => {
                if (msg.embeds.length > 0 && msg.components.length > 0) {
                    const embed = msg.embeds[0];
                    const authorField = embed.fields?.find((f) => f.name === '👤 Заявитель');
                    if (authorField) {
                        const userId = authorField.value.match(/<@!?(\d+)>/)?.[1];
                        if (userId === interaction.user.id) {
                            userAds.push({
                                message: msg,
                                embed: embed,
                                id: embed.footer?.text?.replace('ID: ', '') || 'unknown'
                            });
                        }
                    }
                }
            });
            if (userAds.length === 0) {
                await interaction.reply({
                    content: '📭 У вас нет активных анкет',
                    ephemeral: true
                });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📋 Ваши активные анкеты')
                .setColor('#FFB07C')
                .setDescription(`Найдено анкет: **${userAds.length}**`)
                .setTimestamp();
            userAds.forEach((ad, index) => {
                const title = ad.embed.title || 'Анкета';
                const itemField = ad.embed.fields?.find((f) => f.name === '📦 Товар/Услуга');
                const itemName = itemField?.value || 'Не указано';
                embed.addFields({
                    name: `${index + 1}. ${title}`,
                    value: `📦 ${itemName}\n🆔 ID: \`${ad.id}\``,
                    inline: false
                });
            });
            const row = new discord_js_1.ActionRowBuilder()
                .addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId('close_all_ads')
                .setLabel('🔒 Закрыть все')
                .setStyle(discord_js_1.ButtonStyle.Danger));
            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
        }
        catch (error) {
            console.error('❌ Ошибка в /моианкеты:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при получении анкет',
                ephemeral: true
            });
        }
    }
};
//# sourceMappingURL=myads.js.map