import { Buffer } from "node:buffer";
import type { Guild, TextChannel, GuildMember, Client } from "discord.js";
import {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} from "discord.js";
import { tickets } from "../db/mongo.ts";
import { buildEmbed, buildErrorEmbed, getPngPath, getPngFileName } from "../utils/embed.ts";
import { getGuildConfig } from "../db/mongo.ts";
import { isAdmin } from "../utils/guards.ts";
import type { TicketRecord, TicketMessage } from "../types.ts";
import { logEmbedWebhook, buildLogEmbed } from "../utils/discord.ts";

export async function createTicket(
    client: Client,
    guild: Guild,
    member: GuildMember,
    topic?: string
): Promise<TextChannel | null> {
    const config = await getGuildConfig(guild.id);
    const categoryId = config?.ticketCategoryId;
    const staffRoleId = config?.ticketStaffRoleId ?? config?.adminRoleId;

    const existingTicket = await tickets().findOne({ guildId: guild.id, userId: member.id, open: true });
    if (existingTicket) {
        return null;
    }

    const permOverwrites: any[] = [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        {
            id: member.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        },
        {
            id: client.user!.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages,
            ],
        },
    ];

    if (staffRoleId) {
        permOverwrites.push({
            id: staffRoleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ManageMessages,
            ],
        });
    }

    const channel = await guild.channels.create({
        name: `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
        type: ChannelType.GuildText,
        parent: categoryId ?? undefined,
        permissionOverwrites: permOverwrites,
        topic: `Ticket for ${member.user.tag}${topic ? ` | ${topic}` : ""}`,
    });

    const embed = buildEmbed({
        title: "Support Ticket Opened",
        description:
            `>>> Welcome, <@${member.id}>.\n\n` +
            "A member of staff will be with you shortly.\n\n" +
            `${topic ? `**Topic:** ${topic}\n\n` : ""}` +
            "**-** Use this channel to describe your issue in detail.\n" +
            "**-** Click **Close Ticket** when your issue is resolved.",
        thumbnail: true,
        timestamp: true,
    });

    const closeBtn = new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger);

    const claimBtn = new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Secondary);

    const transcriptBtn = new ButtonBuilder()
        .setCustomId("ticket_transcript")
        .setLabel("Get Transcript")
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeBtn, claimBtn, transcriptBtn);

    if (staffRoleId) {
        await channel.send({ content: `<@&${staffRoleId}>`, embeds: [], components: [] });
    }

    const attachment = new AttachmentBuilder(getPngPath(), { name: getPngFileName() });
    await channel.send({ embeds: [embed], files: [attachment], components: [row] });

    await tickets().insertOne({
        channelId: channel.id,
        guildId: guild.id,
        userId: member.id,
        topic,
        createdAt: new Date(),
        open: true,
        messages: [],
    } as TicketRecord);

    await logEmbedWebhook(client, buildLogEmbed(
        "Ticket Opened",
        `<@${member.id}> opened a ticket in <#${channel.id}>.${topic ? `\n\n**Topic:** ${topic}` : ""}`,
    ), guild.id);

    return channel;
}

export async function closeTicket(
    client: Client,
    channel: TextChannel,
    closedBy: GuildMember
): Promise<void> {
    const ticket = await tickets().findOne({ channelId: channel.id, open: true });
    if (!ticket) return;

    const transcript = buildTranscript(ticket);

    const embed = buildEmbed({
        title: "Ticket Closed",
        description:
            `>>> This ticket has been closed by <@${closedBy.id}>.\n\n` +
            `**Opened by:** <@${ticket.userId}>\n` +
            `**Opened at:** <t:${Math.floor(ticket.createdAt.getTime() / 1000)}:f>\n` +
            `**Closed at:** <t:${Math.floor(Date.now() / 1000)}:f>\n` +
            `**Messages:** ${ticket.messages.length}`,
        timestamp: true,
    });

    await channel.send({ embeds: [embed] });

    const logChannel = client.channels.cache.find(c =>
        c.isTextBased() && (c as TextChannel).name === "ticket-logs"
    ) as TextChannel | undefined;

    if (logChannel && transcript) {
        const transcriptBuffer = Buffer.from(transcript, "utf-8");
        const attachment = new AttachmentBuilder(transcriptBuffer, {
            name: `transcript-${ticket.channelId}.txt`,
        });
        await logChannel.send({
            embeds: [buildEmbed({
                title: "Ticket Transcript",
                description: `>>> Transcript for ticket opened by <@${ticket.userId}>.`,
                fields: [
                    { name: "Channel", value: `>>> #${channel.name}`, inline: true },
                    { name: "Opened by", value: `>>> <@${ticket.userId}>`, inline: true },
                    { name: "Closed by", value: `>>> <@${closedBy.id}>`, inline: true },
                    { name: "Messages", value: `>>> ${ticket.messages.length}`, inline: true },
                ],
                timestamp: true,
            })],
            files: [attachment],
        });
    }

    await tickets().updateOne(
        { channelId: channel.id },
        { $set: { open: false } }
    );

    await logEmbedWebhook(client, buildLogEmbed(
        "Ticket Closed",
        `<@${closedBy.id}> closed ticket <#${channel.id}> (opened by <@${ticket.userId}>).`,
    ), channel.guildId);

    setTimeout(async () => {
        await channel.delete("Ticket closed").catch(console.error);
    }, 5000);
}

function buildTranscript(ticket: TicketRecord): string {
    const lines: string[] = [
        `=== NEXUS TICKET TRANSCRIPT ===`,
        `Channel: ${ticket.channelId}`,
        `Opened by: ${ticket.userId}`,
        `Opened at: ${ticket.createdAt.toISOString()}`,
        `Topic: ${ticket.topic ?? "N/A"}`,
        `Total messages: ${ticket.messages.length}`,
        `================================`,
        "",
    ];

    for (const msg of ticket.messages) {
        const ts = new Date(msg.timestamp).toISOString();
        lines.push(`[${ts}] ${msg.authorTag}: ${msg.content}`);
    }

    return lines.join("\n");
}

export async function addTicketMessage(channelId: string, msg: TicketMessage): Promise<void> {
    await tickets().updateOne(
        { channelId, open: true },
        { $push: { messages: msg as any } }
    );
}

export async function claimTicket(channelId: string, staffId: string): Promise<void> {
    await tickets().updateOne(
        { channelId, open: true },
        { $set: { claimedBy: staffId } }
    );
}

export async function getOpenTicket(channelId: string): Promise<TicketRecord | null> {
    return await tickets().findOne({ channelId, open: true });
}
