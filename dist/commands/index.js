"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setMediaDB = exports.setReportDB = exports.setGiveawayDB = exports.setFamilyDB = exports.setCarsDB = exports.setBirthdayDB = void 0;
exports.registerCommands = registerCommands;
const test_command_1 = require("../test-command");
const buysell_1 = require("./buysell");
const myads_1 = require("./myads");
const stats_1 = require("./stats");
const top_1 = require("./top");
const birthday_1 = require("./birthday");
Object.defineProperty(exports, "setBirthdayDB", { enumerable: true, get: function () { return birthday_1.setBirthdayDB; } });
const cars_1 = require("./cars");
Object.defineProperty(exports, "setCarsDB", { enumerable: true, get: function () { return cars_1.setCarsDB; } });
const family_1 = require("./family");
Object.defineProperty(exports, "setFamilyDB", { enumerable: true, get: function () { return family_1.setFamilyDB; } });
const giveaway_1 = require("./giveaway");
Object.defineProperty(exports, "setGiveawayDB", { enumerable: true, get: function () { return giveaway_1.setGiveawayDB; } });
const report_1 = require("./report");
Object.defineProperty(exports, "setReportDB", { enumerable: true, get: function () { return report_1.setReportDB; } });
const media_1 = require("./media");
Object.defineProperty(exports, "setMediaDB", { enumerable: true, get: function () { return media_1.setMediaDB; } });
function registerCommands() {
    console.log('📝 Регистрируем команды...');
    return [
        test_command_1.testCommand,
        buysell_1.buysellCommand,
        myads_1.myAdsCommand,
        stats_1.statsCommand,
        top_1.topCommand,
        birthday_1.birthdaySetCommand,
        birthday_1.birthdayListCommand,
        birthday_1.adminBirthdaySetCommand,
        birthday_1.birthdayDeleteCommand,
        birthday_1.testBirthdayCommand,
        cars_1.carAddCommand,
        cars_1.carDeleteCommand,
        cars_1.carsMenuCommand,
        family_1.familyInviteCommand,
        giveaway_1.giveawayCreateCommand,
        giveaway_1.giveawayListCommand,
        giveaway_1.giveawayEndCommand,
        report_1.reportMenuCommand,
        report_1.ticketListCommand,
        media_1.twitchAddCommand,
        media_1.twitchDeleteCommand,
        media_1.twitchNotificationCommand,
        media_1.youtubeAddCommand,
        media_1.youtubeDeleteCommand,
        media_1.youtubeNotificationCommand,
        media_1.mediaListCommand,
    ];
}
//# sourceMappingURL=index.js.map