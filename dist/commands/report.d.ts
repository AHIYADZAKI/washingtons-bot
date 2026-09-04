import { ButtonInteraction } from 'discord.js';
import { Command } from './index';
import { Database } from 'sqlite';
export declare function setReportDB(database: Database): void;
export declare const reportMenuCommand: Command;
export declare function handleTicketButtons(interaction: ButtonInteraction): Promise<void>;
export declare function handleTicketModal(interaction: any): Promise<void>;
export declare const ticketListCommand: Command;
//# sourceMappingURL=report.d.ts.map