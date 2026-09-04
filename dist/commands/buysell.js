"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buysellCommand = void 0;
const discord_js_1 = require("discord.js");
exports.buysellCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('buysell')
        .setDescription('Создать меню для покупки/продажи'),
    async execute(interaction) {
        try {
            console.log('✅ Команда /buysell вызвана');
            const peachColor = 0xFFB07C;
            const container = new discord_js_1.ContainerBuilder()
                .setAccentColor(peachColor)
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                .setContent('🍑 **Добро пожаловать в торговую площадку!**'))
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                .setContent('✨ *Здесь вы можете создать анкету для покупки или продажи товаров и услуг.*'))
                .addSeparatorComponents(new discord_js_1.SeparatorBuilder()
                .setSpacing(discord_js_1.SeparatorSpacingSize.Small)
                .setDivider(true))
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                .setContent('🛒 **Создать анкету на покупку**'))
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                .setContent('📌 *Опишите что вы хотите приобрести, укажите бюджет и контактные данные для связи*'))
                .addActionRowComponents(new discord_js_1.ActionRowBuilder()
                .addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId('buy_form')
                .setLabel('🛒 Купить')
                .setStyle(discord_js_1.ButtonStyle.Success)))
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                .setContent('💰 **Создать анкету на продажу**'))
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                .setContent('📌 *Опишите что вы продаете, укажите цену и контактные данные для связи*'))
                .addActionRowComponents(new discord_js_1.ActionRowBuilder()
                .addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId('sell_form')
                .setLabel('💰 Продать')
                .setStyle(discord_js_1.ButtonStyle.Primary)))
                .addSeparatorComponents(new discord_js_1.SeparatorBuilder()
                .setSpacing(discord_js_1.SeparatorSpacingSize.Small)
                .setDivider(true))
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                .setContent('📋 **Правила оформления анкет:**'))
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                .setContent('• Заполняйте все поля максимально подробно\n• Указывайте реальную цену и контакты\n• Будьте вежливы и адекватны\n• Администрация оставляет за собой право удалять анкеты'))
                .addSeparatorComponents(new discord_js_1.SeparatorBuilder()
                .setSpacing(discord_js_1.SeparatorSpacingSize.Small)
                .setDivider(true))
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder()
                .setContent('💫 *С уважением, Администрация торговой площадки\n Если хотите добавить бота к себе, для меж серверной торговли,\n свяжитесь с **ahiyadzaki** *'));
            await interaction.reply({
                components: [container],
                flags: discord_js_1.MessageFlags.IsComponentsV2
            });
            console.log('✅ Красивое меню Components V2 отправлено');
        }
        catch (error) {
            console.error('❌ Ошибка в /buysell:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при создании меню',
                ephemeral: true
            });
        }
    }
};
//# sourceMappingURL=buysell.js.map