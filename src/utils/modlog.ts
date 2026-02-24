import { EmbedBuilder, type Guild, type TextChannel, type User } from "discord.js";
import { getGuildConfig } from "../db/mongo.ts";

const COLOUR = 0x4f59c1;
const FOOTER = "Nexus";

const ACTION_COLOURS: Record<string, number> = {
    Ban: 0xe74c3c,
    Unban: 0x2ecc71,
    Kick: 0xe67e22,
    Softban: 0xe74c3c,
    Mute: 0xf39c12,
    Unmute: 0x2ecc71,
    Warn: 0xf1c40f,
    "Clear Warnings": 0x3498db,
    Purge: 0x9b59b6,
};

interface ModLogEntry {
    action: string;
    target: User;
    moderator: User;
    reason?: string | null;
    extra?: string | null;
}

export async function sendModLog(guild: Guild, entry: ModLogEntry): Promise<void> {
    const config = await getGuildConfig(guild.id);
    if (!config?.modLogChannelId) return;

    const channel = guild.channels.cache.get(config.modLogChannelId) as TextChannel | undefined;
    if (!channel) return;

    const colour = ACTION_COLOURS[entry.action] ?? COLOUR;

    const embed = new EmbedBuilder()
        .setColor(colour)
        .setAuthor({ name: `${entry.moderator.tag}`, iconURL: entry.moderator.displayAvatarURL() })
        .setDescription(
            `**Action:** ${entry.action}\n` +
            `**Target:** ${entry.target.tag} (${entry.target.id})\n` +
            `**Reason:** ${entry.reason ?? "No reason provided"}` +
            (entry.extra ? `\n${entry.extra}` : "")
        )
        .setFooter({ text: FOOTER })
        .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => { });
}

export async function dmUser(
    target: User,
    guild: Guild,
    action: string,
    reason?: string | null,
): Promise<void> {
    const embed = new EmbedBuilder()
        .setColor(ACTION_COLOURS[action] ?? COLOUR)
        .setTitle(`You have been ${action.toLowerCase()}${action.endsWith("e") ? "d" : "ed"} in ${guild.name}`)
        .setDescription(`>>> **Reason:** ${reason ?? "No reason provided"}`)
        .setFooter({ text: FOOTER })
        .setTimestamp();

    await target.send({ embeds: [embed] }).catch(() => { });
}
