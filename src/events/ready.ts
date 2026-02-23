import type { Client } from "discord.js";
import { buildLogEmbed } from "../utils/discord.ts";
import { logEmbedWebhook } from "../utils/discord.ts";

export default async function onReady(client: Client) {
    if (!client.user) return;
    console.log(`[BOT] Logged in as ${client.user.tag}`);

    await logEmbedWebhook(client, buildLogEmbed(
        "Nexus Bot Online",
        `**${client.user.tag}** has connected.\n\n` +
        `**Servers:** ${client.guilds.cache.size}\n` +
        `**Users:** ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
    )).catch(console.error);
}
