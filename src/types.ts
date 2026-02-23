import type {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
    Collection,
    Client,
} from "discord.js";

export interface Command {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface GuildConfig {
    guildId: string;
    adminRoleId?: string;
    memberRoleIds: string[];
    altRoleId?: string;
    mutedRoleId?: string;
    autoRoleId?: string;
    welcomeChannelId?: string;
    logChannelId?: string;
    ticketCategoryId?: string;
    ticketStaffRoleId?: string;
}

export interface VerificationRecord {
    userId: string;
    ipHash: string;
    verifiedAt: Date;
}

export interface PendingDeletion {
    userId: string;
    requestedAt: Date;
}

export interface TicketRecord {
    channelId: string;
    guildId: string;
    userId: string;
    topic?: string;
    createdAt: Date;
    open: boolean;
    claimedBy?: string;
    messages: TicketMessage[];
}

export interface TicketMessage {
    authorId: string;
    authorTag: string;
    content: string;
    timestamp: Date;
}

export interface AutoModApplied {
    guildId: string;
    presetName: string;
    appliedAt: Date;
}

export interface ExtendedClient extends Client {
    commands: Collection<string, Command>;
}
