"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.topCommand = void 0;
const discord_js_1 = require("discord.js");
const stats_1 = __importDefault(require("../modules/stats"));
exports.topCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('топ')
        .setDescription('Показать топ-10 пользователей')
        .addStringOption((option) => option
        .setName('тип')
        .setDescription('Тип топа')
        .setRequired(true)
        .addChoices({ name: '📝 По сообщениям', value: 'messages' }, { name: '🎤 По голосовому времени', value: 'voice' })),
    async execute(interaction) {
        try {
            if (!interaction.isChatInputCommand())
                return;
            const type = interaction.options.getString('тип', true);
            const embed = await stats_1.default.createTopEmbed(type);
            if (!embed) {
                await interaction.reply({
                    content: '❌ Нет данных для отображения',
                    ephemeral: true
                });
                return;
            }
            await interaction.reply({
                embeds: [embed]
            });
        }
        catch (error) {
            console.error('❌ Ошибка в /топ:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при получении топа',
                ephemeral: true
            });
        }
    }
};
//# sourceMappingURL=top.js.map