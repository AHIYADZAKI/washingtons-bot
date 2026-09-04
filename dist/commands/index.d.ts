import { SlashCommandBuilder } from 'discord.js';
import { setBirthdayDB } from './birthday';
import { setCarsDB } from './cars';
import { setFamilyDB } from './family';
import { setGiveawayDB } from './giveaway';
import { setReportDB } from './report';
import { setMediaDB } from './media';
export interface Command {
    data: SlashCommandBuilder;
    execute: (interaction: any) => Promise<void>;
}
export declare function registerCommands(): Command[];
export { setBirthdayDB, setCarsDB, setFamilyDB, setGiveawayDB, setReportDB, setMediaDB };
//# sourceMappingURL=index.d.ts.map