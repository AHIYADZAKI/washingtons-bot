import { SlashCommandBuilder } from 'discord.js';
import { testCommand } from '../test-command';
import { buysellCommand } from './buysell';
import { myAdsCommand } from './myads';
import { statsCommand } from './stats';
import { topCommand } from './top';
import { 
  birthdaySetCommand, 
  birthdayListCommand, 
  adminBirthdaySetCommand,
  birthdayDeleteCommand,
  testBirthdayCommand,
  setBirthdayDB 
} from './birthday';
import { 
  carAddCommand, 
  carDeleteCommand, 
  carsMenuCommand,
  setCarsDB
} from './cars';
import { 
  familyInviteCommand,
  setFamilyDB
} from './family';
import { 
  giveawayCreateCommand,
  giveawayListCommand,
  giveawayEndCommand,
  setGiveawayDB
} from './giveaway';
import { 
  reportMenuCommand,
  ticketListCommand,
  setReportDB
} from './report';
import { 
  twitchAddCommand,
  twitchDeleteCommand,
  twitchNotificationCommand,
  youtubeAddCommand,
  youtubeDeleteCommand,
  youtubeNotificationCommand,
  mediaListCommand,
  setMediaDB
} from './media';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: any) => Promise<void>;
}

export function registerCommands(): Command[] {
  console.log('📝 Регистрируем команды...');
  return [
    testCommand,
    buysellCommand,
    myAdsCommand,
    statsCommand,
    topCommand,
    birthdaySetCommand,
    birthdayListCommand,
    adminBirthdaySetCommand,
    birthdayDeleteCommand,
    testBirthdayCommand,
    carAddCommand,
    carDeleteCommand,
    carsMenuCommand,
    familyInviteCommand,
    giveawayCreateCommand,
    giveawayListCommand,
    giveawayEndCommand,
    reportMenuCommand,
    ticketListCommand,
    twitchAddCommand,
    twitchDeleteCommand,
    twitchNotificationCommand,
    youtubeAddCommand,
    youtubeDeleteCommand,
    youtubeNotificationCommand,
    mediaListCommand,
  ];
}

export { setBirthdayDB, setCarsDB, setFamilyDB, setGiveawayDB, setReportDB, setMediaDB };