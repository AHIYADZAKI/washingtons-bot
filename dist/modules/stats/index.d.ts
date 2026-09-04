import { VoiceState, Message, EmbedBuilder } from 'discord.js';
import { Database } from 'sqlite';
declare class StatsModule {
    private db;
    private voiceTimers;
    private readonly weekDays;
    private botStartTime;
    constructor();
    setDatabase(db: Database): void;
    handleMessage(message: Message): Promise<void>;
    handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void>;
    private addVoiceTime;
    private updateWeeklyStats;
    getUserStats(userId: string): Promise<any>;
    getTopUsersByMessages(limit?: number): Promise<any[]>;
    getTopUsersByVoice(limit?: number): Promise<any[]>;
    createStatsEmbed(userId: string): Promise<EmbedBuilder | null>;
    createTopEmbed(type: 'messages' | 'voice'): Promise<EmbedBuilder | null>;
    checkInactiveUsers(guildId: string, familyRoleId: string, inactiveRoleId: string): Promise<void>;
}
declare const _default: StatsModule;
export default _default;
//# sourceMappingURL=index.d.ts.map