import { ButtonInteraction } from 'discord.js';
import { Command } from './index';
import { Database } from 'sqlite';
export declare function setCarsDB(database: Database): void;
export declare const carAddCommand: Command;
export declare const carDeleteCommand: Command;
export declare const carsMenuCommand: Command;
export declare function handleCarsButtons(interaction: ButtonInteraction): Promise<void>;
export declare function handleCarsSelect(interaction: any): Promise<void>;
//# sourceMappingURL=cars.d.ts.map