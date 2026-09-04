import { ButtonInteraction } from 'discord.js';
import { Command } from './index';
import { Database } from 'sqlite';
export declare function setFamilyDB(database: Database): void;
export declare const familyInviteCommand: Command;
export declare function handleFamilyApply(interaction: ButtonInteraction): Promise<void>;
export declare function handleFamilyModal(interaction: any): Promise<void>;
export declare function handleFamilyModeration(interaction: ButtonInteraction): Promise<void>;
export declare function handleFamilyBirthdayModal(interaction: any): Promise<void>;
export declare function handleFamilyRejectModal(interaction: any): Promise<void>;
//# sourceMappingURL=family.d.ts.map