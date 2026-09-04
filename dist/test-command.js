"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testCommand = void 0;
const discord_js_1 = require("discord.js");
exports.testCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('test')
        .setDescription('Тестовая команда'),
    async execute(interaction) {
        try {
            console.log('✅ Команда /test вызвана!');
            await interaction.reply({
                content: '✅ Бот работает!',
                ephemeral: true
            });
        }
        catch (error) {
            console.error('❌ Ошибка в /test:', error);
        }
    }
};
//# sourceMappingURL=test-command.js.map