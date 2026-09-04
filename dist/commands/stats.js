"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsCommand = void 0;
const discord_js_1 = require("discord.js");
const stats_1 = __importDefault(require("../modules/stats"));
exports.statsCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('статистика')
        .setDescription('Показать вашу статистику')
        .addUserOption((option) => option
        .setName('пользователь')
        .setDescription('Пользователь, чью статистику показать')
        .setRequired(false)),
    async execute(interaction) {
        try {
            if (!interaction.isChatInputCommand())
                return;
            const targetUser = interaction.options.getUser('пользователь') || interaction.user;
            const embed = await stats_1.default.createStatsEmbed(targetUser.id);
            if (!embed) {
                await interaction.reply({
                    content: '❌ Статистика для этого пользователя не найдена',
                    ephemeral: true
                });
                return;
            }
            embed.setAuthor({
                name: targetUser.username,
                iconURL: targetUser.displayAvatarURL()
            });
            await interaction.reply({
                embeds: [embed]
            });
        }
        catch (error) {
            console.error('❌ Ошибка в /статистика:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при получении статистики',
                ephemeral: true
            });
        }
    }
};
//# sourceMappingURL=stats.js.map