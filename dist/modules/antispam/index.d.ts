import { Message } from 'discord.js';
declare class AntiSpamModule {
    private messageCache;
    private guildSpamTracker;
    private readonly maxMessages;
    private readonly timeWindow;
    private readonly similarThreshold;
    private readonly globalSpamThreshold;
    constructor();
    checkSpam(message: Message): boolean;
    checkGlobalSpam(message: Message): boolean;
    private isSimilar;
    private calculateSimilarity;
    private cleanCache;
    private cleanGuildTracker;
    handleSpam(message: Message): Promise<void>;
}
declare const _default: AntiSpamModule;
export default _default;
//# sourceMappingURL=index.d.ts.map