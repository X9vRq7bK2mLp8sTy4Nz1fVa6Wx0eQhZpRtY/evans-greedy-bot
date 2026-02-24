import {
    Client,
    GatewayIntentBits,
    Collection,
    REST,
    Routes,
} from "discord.js";
import { Hono } from "hono";
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
// import autoRoleCommand from "./commands/autorole.ts";
import welcomeCommand from "./commands/welcome.ts";
import embedCommand from "./commands/embed.ts";
import manVerifyCommand from "./commands/manverify.ts";
import deletePendingCommand from "./commands/deletepending.ts";
import automodCommand from "./commands/automod.ts";
import ticketCommand from "./commands/ticket.ts";
import setVerifiedRoleCommand from "./commands/set-verified-role.ts";
import setUnverifiedRoleCommand from "./commands/set-unverified-role.ts";
import cantTalkCommand from "./commands/cant-talk.ts";
import banCommand from "./commands/ban.ts";
import unbanCommand from "./commands/unban.ts";
import kickCommand from "./commands/kick.ts";
import muteCommand from "./commands/mute.ts";
import unmuteCommand from "./commands/unmute.ts";
import warnCommand from "./commands/warn.ts";
import warningsCommand from "./commands/warnings.ts";
import clearwarningsCommand from "./commands/clearwarnings.ts";
import purgeCommand from "./commands/purge.ts";
import slowmodeCommand from "./commands/slowmode.ts";
import softbanCommand from "./commands/softban.ts";
import nickCommand from "./commands/nick.ts";
import roleCommand from "./commands/role.ts";
import userinfoCommand from "./commands/userinfo.ts";
import serverinfoCommand from "./commands/serverinfo.ts";
import setModlogCommand from "./commands/set-modlog.ts";

const TOKEN = Deno.env.get("DISCORD_TOKEN");
const CLIENT_ID = Deno.env.get("DISCORD_CLIENT_ID") || "";

if (!TOKEN) throw new Error("DISCORD_TOKEN is not set");
if (!CLIENT_ID) throw new Error("DISCORD_CLIENT_ID is not set");

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
    // autoRoleCommand,
    welcomeCommand,
    embedCommand,
    manVerifyCommand,
    deletePendingCommand,
    automodCommand,
    ticketCommand,
    setVerifiedRoleCommand,
    setUnverifiedRoleCommand,
    cantTalkCommand,
    banCommand,
    unbanCommand,
    kickCommand,
    muteCommand,
    unmuteCommand,
    warnCommand,
    warningsCommand,
    clearwarningsCommand,
    purgeCommand,
    slowmodeCommand,
    softbanCommand,
    nickCommand,
    roleCommand,
    userinfoCommand,
    serverinfoCommand,
    setModlogCommand,
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
    const GUILD_ID = Deno.env.get("GUILD_ID");
    const cmdData = commands.map(c => c.data.toJSON());

    try {
        if (GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: cmdData });
            console.log(`[DEPLOY] Slash commands deployed to guild: ${GUILD_ID}`);
        } else {
            // Fallback: register for all guilds currently joined
            const guilds = client.guilds.cache.map(g => g.id);
            for (const id of guilds) {
                await rest.put(Routes.applicationGuildCommands(CLIENT_ID, id), { body: cmdData })
                    .catch(e => console.error(`[DEPLOY] Failed for guild ${id}:`, e));
            }
            console.log(`[DEPLOY] Slash commands deployed to ${guilds.length} guild(s).`);
        }
    } catch (err) {
        console.error("[DEPLOY] Error deploying commands:", err);
    }
});

const verificationMap = new Map<string, (data: any) => void>();

const app = new Hono();
const PORT = Number(Deno.env.get("PORT") ?? 3000);

app.get("/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const ip = c.req.header("X-Forwarded-For") ?? c.req.header("CF-Connecting-IP") ?? "0.0.0.0";

    if (!code) return c.redirect("/error?reason=no_code");

    let token: string;
    let user: { id: string; username: string };
    try {
        token = await getToken(code);
        user = await getUserData(token);
        await invalidateToken(token);
    } catch {
        return c.redirect("/error?reason=oauth_failed");
    }

    if (state) {
        const resolver = verificationMap.get(state);
        if (!resolver) return c.redirect("/error?reason=invalid_state");
        resolver({ ip, id: user.id });
        verificationMap.delete(state);
        return c.redirect(`/passed?id=${user.id}`);
    }

    const guildId = Deno.env.get("GUILD_ID");
    if (!guildId) return c.redirect("/error?reason=no_guild");

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return c.redirect("/error?reason=guild_not_found");

    const config = await getGuildConfig(guildId);
    const mutedRoleId = config?.mutedRoleId;
    const altRoleId = config?.altRoleId;
    const memberRoles = config?.memberRoleIds ?? [];

    if (mutedRoleId && await checkRole(guild, user.id, mutedRoleId)) {
        await logEmbedWebhook(client, buildLogEmbed("Verification Blocked", `<@${user.id}> tried to verify while muted.`, 0xe74c3c));
        return c.redirect("/flagged?reason=muted");
    }

    if (altRoleId && await checkRole(guild, user.id, altRoleId)) {
        await logEmbedWebhook(client, buildLogEmbed("Alt Blocked", `<@${user.id}> tried to verify while flagged as alt.`, 0xe74c3c));
        return c.redirect("/flagged?reason=alt");
    }

    const ipHash = hashIp(ip);
    const existing = await checkVerified(ipHash);
    if (existing && existing.userId !== user.id) {
        if (altRoleId) await grantRole(guild, user.id, altRoleId);
        await logEmbedWebhook(client, buildLogEmbed("Alt Account Detected", `<@${user.id}> was flagged as an alt of <@${existing.userId}>.`, 0xe74c3c));
        return c.redirect("/altflagged");
    }

    const ipData = await getIpData(ip).catch(() => null);
    if (ipData) {
        if (ipData.mobile) {
            await logEmbedWebhook(client, buildLogEmbed("Mobile Verification", `<@${user.id}> tried to verify over mobile data.`, 0xf39c12));
            return c.redirect("/mobile");
        }
        if (ipData.proxy || ipData.hosting) {
            await logEmbedWebhook(client, buildLogEmbed("VPN/Proxy Blocked", `<@${user.id}> tried to verify over a proxy or VPN.`, 0xe74c3c));
            return c.redirect("/flagged?reason=vpn");
        }
    }

    await setVerified(user.id, ip);
    if (memberRoles.length > 0) {
        await grantRole(guild, user.id, memberRoles);
    }
    await logEmbedWebhook(client, buildLogEmbed("Verified", `<@${user.id}> successfully verified.`, 0x2ecc71));
    return c.redirect(`/passed?id=${user.id}`);
});

app.get("/delete-request", async (c) => {
    const userId = c.req.query("userId");
    if (!userId) return c.json({ error: "Missing userId" }, 400);
    await addPendingDeletion(userId);
    return c.json({ success: true });
});

const NEXUS_ICON = (id: string, icon: string) => id && icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.png` : "";

function page(title: string, body: string, isError = false): string {
    const guildId = Deno.env.get("GUILD_ID") ?? "";
    const guildIcon = Deno.env.get("GUILD_ICON") ?? "";
    const iconUrl = NEXUS_ICON(guildId, guildIcon);
    const accent = isError ? "#ef4444" : "#ffffff";
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Nexus</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.card{background:#09090b;border:1px solid #27272a;padding:48px 32px;max-width:380px;width:100%;text-align:center}.icon{width:64px;height:64px;border-radius:50%;background:#000;border:1px solid #27272a;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;overflow:hidden}.icon img{width:100%;height:100%;object-fit:cover}.server{font-size:12px;font-weight:600;color:#71717a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px}.title{font-size:20px;font-weight:600;margin-bottom:12px;color:${accent}}.subtitle{font-size:14px;color:#a1a1aa;line-height:1.6;margin-bottom:24px}.id{display:inline-block;background:#18181b;border:1px solid #27272a;padding:6px 12px;font-size:11px;color:#71717a;font-family:ui-monospace,monospace;letter-spacing:.05em}</style></head><body><div class="card"><div class="icon">${iconUrl ? `<img src="${iconUrl}" alt="Nexus">` : `<span>N</span>`}</div><div class="server">Nexus</div>${body}</div></body></html>`.replace(/>\s+</g, '><').trim();
}

app.get("/passed", (c) => {
    const id = c.req.query("id") ?? "";
    return c.html(page("Verified", `
        <div class="title">Verification Successful</div>
        <p class="subtitle">Your identity has been confirmed. You may now return to the Nexus server.</p>
        ${id ? `<div class="id">UID: ${id}</div>` : ""}
    `));
});

app.get("/flagged", (c) => {
    const r = c.req.query("reason") ?? "";
    const msg = r === "muted" ? "Your account is currently muted." : r === "vpn" ? "VPN/Proxy connections are not permitted." : "Your verification request was flagged.";
    return c.html(page("Flagged", `
        <div class="title">Access Denied</div>
        <p class="subtitle">${msg}</p>
    `, true));
});

app.get("/altflagged", (c) => c.html(page("Alt Detected", `
    <div class="title">Security Flag</div>
    <p class="subtitle">This IP is already linked to another account. Alternate accounts are not permitted.</p>
`, true)));

app.get("/mobile", (c) => c.html(page("Mobile Blocked", `
    <div class="title">Incompatible Connection</div>
    <p class="subtitle">Verification is not permitted over mobile data. Please use a stable Wi-Fi connection.</p>
`, true)));

app.get("/error", (c) => c.html(page("Error", `
    <div class="title">System Error</div>
    <p class="subtitle">Something went wrong during the verification process. Please try again later.</p>
    <div class="id">CODE: ${c.req.query("reason") ?? "UNK"}</div>
`, true)));

Deno.serve({ port: PORT, onListen: ({ port }) => console.log(`[HTTP] Verification server running on port ${port}`) }, app.fetch);

await client.login(TOKEN);
