import {
    WebhookClient,
    EmbedBuilder,
    type TextChannel,
    type Guild,
    type Client,
    type RoleResolvable,
    type GuildMemberResolvable,
} from "discord.js";
import { getGuildConfig } from "../db/mongo.ts";

const COLOUR = 0x4f59c1;
const FOOTER = "Nexus";

export async function grantRole(
    guild: Guild,
    id: GuildMemberResolvable,
    roles: RoleResolvable | RoleResolvable[]
): Promise<void> {
    const member = await guild.members.fetch(id as string).catch(() => null);
    if (!member) return;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    await member.roles.add(roleArray).catch(console.error);
}

export async function removeRole(
    guild: Guild,
    id: GuildMemberResolvable,
    roles: RoleResolvable | RoleResolvable[]
): Promise<void> {
    const member = await guild.members.fetch(id as string).catch(() => null);
    if (!member) return;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    await member.roles.remove(roleArray).catch(console.error);
}

export async function checkRole(
    guild: Guild,
    id: GuildMemberResolvable,
    roleId: string
): Promise<boolean> {
    const member = await guild.members.fetch(id as string).catch(() => null);
    if (!member) return false;
    return member.roles.cache.has(roleId);
}

export async function logWebhook(client: Client, content: string, guildId?: string): Promise<void> {
    if (guildId) {
        const config = await getGuildConfig(guildId);
        if (config?.systemLogChannelId) {
            const guild = client.guilds.cache.get(guildId);
            const channel = guild?.channels.cache.get(config.systemLogChannelId) as TextChannel | undefined;
            if (channel) {
                const embed = buildLogEmbed("System Log", content);
                await channel.send({ embeds: [embed] }).catch(() => { });
                return;
            }
        }
    }

    const url = Deno.env.get("LOG_WEBHOOK_URL");
    if (!url || !client.user) return;
    const webhookClient = new WebhookClient({ url });
    await webhookClient.send({
        username: client.user.username,
        avatarURL: client.user.avatarURL() ?? undefined,
        content: `>>> ${content}`,
    }).catch(console.error);
}

export async function logEmbedWebhook(client: Client, embed: EmbedBuilder, guildId?: string): Promise<void> {
    if (guildId) {
        const config = await getGuildConfig(guildId);
        if (config?.systemLogChannelId) {
            const guild = client.guilds.cache.get(guildId);
            const channel = guild?.channels.cache.get(config.systemLogChannelId) as TextChannel | undefined;
            if (channel) {
                await channel.send({ embeds: [embed] }).catch(() => { });
                return;
            }
        }
    }

    const url = Deno.env.get("LOG_WEBHOOK_URL");
    if (!url || !client.user) return;
    const webhookClient = new WebhookClient({ url });
    await webhookClient.send({
        username: client.user.username,
        avatarURL: client.user.avatarURL() ?? undefined,
        embeds: [embed],
    }).catch(console.error);
}

export function buildLogEmbed(title: string, description: string, colour?: number): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(colour ?? COLOUR)
        .setTitle(title)
        .setDescription(`>>> ${description}`)
        .setFooter({ text: FOOTER })
        .setTimestamp();
}
