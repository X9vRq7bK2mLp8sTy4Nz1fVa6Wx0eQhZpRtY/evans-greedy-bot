import "dotenv/config";
import {
    Client,
    GatewayIntentBits,
    Collection,
    REST,
    Routes,
} from "discord.js";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { connectDB, checkVerified, setVerified, addPendingDeletion, getGuildConfig } from "./db/mongo.ts";
import { getIpData } from "./utils/ip.ts";
import { getToken, getUserData, invalidateToken } from "./utils/oauth.ts";
import { hashIp } from "./db/mongo.ts";
import { grantRole, checkRole, logEmbedWebhook, buildLogEmbed } from "./utils/discord.ts";
import type { Command, ExtendedClient } from "./types.ts";
import onReady from "./events/ready.ts";
import onGuildMemberAdd from "./events/guildMemberAdd.ts";
import onInteractionCreate from "./events/interactionCreate.ts";
import onMessageCreate from "./events/messageCreate.ts";

import setAdminCommand from "./commands/set-admin.ts";
import sendPanelCommand from "./commands/send-panel.ts";
import autoRoleCommand from "./commands/autorole.ts";
import welcomeCommand from "./commands/welcome.ts";
import embedCommand from "./commands/embed.ts";
import manVerifyCommand from "./commands/manverify.ts";
import deletePendingCommand from "./commands/deletepending.ts";
import automodCommand from "./commands/automod.ts";
import ticketCommand from "./commands/ticket.ts";

const TOKEN = Deno.env.get("DISCORD_TOKEN");
const CLIENT_ID = Deno.env.get("DISCORD_CLIENT_ID") || "";

if (!TOKEN) throw new Error("DISCORD_TOKEN is not set");

await connectDB();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
    ],
}) as ExtendedClient;

client.commands = new Collection<string, Command>();

const commands: Command[] = [
    setAdminCommand,
    sendPanelCommand,
    autoRoleCommand,
    welcomeCommand,
    embedCommand,
    manVerifyCommand,
    deletePendingCommand,
    automodCommand,
    ticketCommand,
];

for (const cmd of commands) {
    client.commands.set(cmd.data.name, cmd);
}

const rest = new REST().setToken(TOKEN);

client.once("ready", () => onReady(client));
client.on("guildMemberAdd", onGuildMemberAdd);
client.on("interactionCreate", onInteractionCreate);
client.on("messageCreate", onMessageCreate);

client.once("ready", async () => {
    const guilds = client.guilds.cache.map(g => g.id);
    const cmdData = commands.map(c => c.data.toJSON());
    for (const guildId of guilds) {
        await rest
            .put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: cmdData })
            .catch(e => console.error(`[DEPLOY] Failed for guild ${guildId}:`, e));
    }
    console.log(`[DEPLOY] Slash commands deployed to ${guilds.length} guild(s).`);
});

const verificationMap = new Map<string, (data: any) => void>();

const app = new Hono();
const PORT = Number(Deno.env.get("PORT") ?? 3000);

app.get("/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const ip = c.req.header("X-Forwarded-For") ?? c.req.header("CF-Connecting-IP") ?? "0.0.0.0";

    if (!code) return c.redirect("/error.html?reason=no_code");

    let token: string;
    let user: { id: string; username: string };
    try {
        token = await getToken(code);
        user = await getUserData(token);
        await invalidateToken(token);
    } catch {
        return c.redirect("/error.html?reason=oauth_failed");
    }

    if (state) {
        const resolver = verificationMap.get(state);
        if (!resolver) return c.redirect("/error.html?reason=invalid_state");
        resolver({ ip, id: user.id });
        verificationMap.delete(state);
        return c.redirect("/passed.html");
    }

    const guildId = Deno.env.get("GUILD_ID");
    if (!guildId) return c.redirect("/error.html?reason=no_guild");

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return c.redirect("/error.html?reason=guild_not_found");

    const config = await getGuildConfig(guildId);
    const mutedRoleId = config?.mutedRoleId;
    const altRoleId = config?.altRoleId;
    const memberRoles = config?.memberRoleIds ?? [];

    if (mutedRoleId && await checkRole(guild, user.id, mutedRoleId)) {
        await logEmbedWebhook(client, buildLogEmbed("Verification Blocked", `<@${user.id}> tried to verify while muted.`, 0xe74c3c));
        return c.redirect("/flagged.html?reason=muted");
    }

    if (altRoleId && await checkRole(guild, user.id, altRoleId)) {
        await logEmbedWebhook(client, buildLogEmbed("Alt Blocked", `<@${user.id}> tried to verify while flagged as alt.`, 0xe74c3c));
        return c.redirect("/flagged.html?reason=alt");
    }

    const ipHash = hashIp(ip);
    const existing = await checkVerified(ipHash);
    if (existing && existing.userId !== user.id) {
        if (altRoleId) await grantRole(guild, user.id, altRoleId);
        await logEmbedWebhook(client, buildLogEmbed("Alt Account Detected", `<@${user.id}> was flagged as an alt of <@${existing.userId}>.`, 0xe74c3c));
        return c.redirect("/altflagged.html");
    }

    const ipData = await getIpData(ip).catch(() => null);
    if (ipData) {
        if (ipData.mobile) {
            await logEmbedWebhook(client, buildLogEmbed("Mobile Verification", `<@${user.id}> tried to verify over mobile data.`, 0xf39c12));
            return c.redirect("/mobile.html");
        }
        if (ipData.proxy || ipData.hosting) {
            await logEmbedWebhook(client, buildLogEmbed("VPN/Proxy Blocked", `<@${user.id}> tried to verify over a proxy or VPN.`, 0xe74c3c));
            return c.redirect("/flagged.html?reason=vpn");
        }
    }

    await setVerified(user.id, ip);
    if (memberRoles.length > 0) {
        await grantRole(guild, user.id, memberRoles);
    }
    await logEmbedWebhook(client, buildLogEmbed("Verified", `<@${user.id}> successfully verified.`, 0x2ecc71));
    return c.redirect("/passed.html");
});

app.get("/delete-request", async (c) => {
    const userId = c.req.query("userId");
    if (!userId) return c.json({ error: "Missing userId" }, 400);
    await addPendingDeletion(userId);
    return c.json({ success: true });
});

serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[HTTP] Verification server running on port ${PORT}`);
});

await client.login(TOKEN);
