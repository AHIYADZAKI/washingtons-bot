import { Command } from './index';
import { Database } from 'sqlite';
export declare function setGiveawayDB(database: Database): void;
export declare function checkGiveaways(client: any): Promise<void>;
export declare const giveawayCreateCommand: Command;
export declare const giveawayListCommand: Command;
export declare const giveawayEndCommand: Command;
//# sourceMappingURL=giveaway.d.ts.map