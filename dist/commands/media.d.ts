import { Command } from './index';
import { Database } from 'sqlite';
export declare function setMediaDB(database: Database): void;
export declare const twitchAddCommand: Command;
export declare const twitchDeleteCommand: Command;
export declare const twitchNotificationCommand: Command;
export declare const youtubeAddCommand: Command;
export declare const youtubeDeleteCommand: Command;
export declare const youtubeNotificationCommand: Command;
export declare const mediaListCommand: Command;
export declare function checkMediaStatus(client: any): Promise<void>;
//# sourceMappingURL=media.d.ts.map