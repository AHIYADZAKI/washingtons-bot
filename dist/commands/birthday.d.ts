import { ButtonInteraction, TextChannel, NewsChannel, StageChannel, VoiceChannel, ThreadChannel, DMChannel } from 'discord.js';
import { Command } from './index';
import { Database } from 'sqlite';
export declare const calendarMessages: Map<string, string>;
export declare function setBirthdayDB(database: Database): void;
export declare function updateCalendarIfExists(channel: TextChannel | NewsChannel | StageChannel | VoiceChannel | ThreadChannel | DMChannel): Promise<void>;
export declare const birthdaySetCommand: Command;
export declare const birthdayListCommand: Command;
export declare const adminBirthdaySetCommand: Command;
export declare const birthdayDeleteCommand: Command;
export declare const testBirthdayCommand: Command;
export declare function handleBirthdayButtons(interaction: ButtonInteraction): Promise<void>;
export declare function checkBirthdays(client: any): Promise<void>;
//# sourceMappingURL=birthday.d.ts.map