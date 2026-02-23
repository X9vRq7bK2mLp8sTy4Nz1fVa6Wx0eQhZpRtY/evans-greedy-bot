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
import autoRoleCommand from "./commands/autorole.ts";
import welcomeCommand from "./commands/welcome.ts";
import embedCommand from "./commands/embed.ts";
import manVerifyCommand from "./commands/manverify.ts";
import deletePendingCommand from "./commands/deletepending.ts";
import automodCommand from "./commands/automod.ts";
import ticketCommand from "./commands/ticket.ts";
import setVerifiedRoleCommand from "./commands/set-verified-role.ts";

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
    setVerifiedRoleCommand,
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

const NEXUS_ICON = "https://cdn.discordapp.com/icons/" + (Deno.env.get("GUILD_ID") ?? "") + "/" + (Deno.env.get("GUILD_ICON") ?? "") + ".png";

function page(title: string, body: string, accent: string = "#4f59c1"): string {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Nexus</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:#0f1117;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{background:#1a1f2e;border:1px solid #2d3553;border-radius:16px;padding:48px 40px;max-width:440px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}.icon{font-size:56px;margin-bottom:20px}.server-name{font-size:13px;font-weight:600;color:${accent};letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}.title{font-size:28px;font-weight:700;margin-bottom:12px}.subtitle{font-size:15px;color:#94a3b8;line-height:1.6}.id-tag{display:inline-block;margin-top:20px;background:#0f1117;border:1px solid #2d3553;border-radius:8px;padding:8px 16px;font-size:13px;color:#64748b;font-family:monospace}</style></head><body><div class="card">${body}</div></body></html>`;
}

app.get("/passed", (c) => {
    const userId = c.req.query("id") ?? "";
    const body = `
        <div class="server-name">Nexus</div>
        <div class="icon">&#10003;</div>
        <div class="title" style="color:#4f59c1">Verified Successfully</div>
        <div class="subtitle">Your account has been verified and you now have access to Nexus.</div>
        ${userId ? `<div class="id-tag">ID: ${userId}</div>` : ""}
    `;
    return c.html(page("Verified", body));
});

app.get("/flagged", (c) => {
    const reason = c.req.query("reason") ?? "unknown";
    const messages: Record<string, string> = {
        muted: "Your account is currently muted and cannot be verified.",
        alt: "Your account has been flagged as an alternate account.",
        vpn: "VPN, proxy, and hosting connections are not permitted during verification.",
    };
    const body = `
        <div class="server-name">Nexus</div>
        <div class="icon">&#x26A0;</div>
        <div class="title" style="color:#e74c3c">Verification Blocked</div>
        <div class="subtitle">${messages[reason] ?? "Your verification was blocked. Please contact a staff member."}</div>
    `;
    return c.html(page("Blocked", body, "#e74c3c"));
});

app.get("/altflagged", (c) => {
    const body = `
        <div class="server-name">Nexus</div>
        <div class="icon">&#x26A0;</div>
        <div class="title" style="color:#e74c3c">Alt Account Detected</div>
        <div class="subtitle">Your IP address is associated with an existing account. You have been flagged as an alternate account. Contact staff if this is a mistake.</div>
    `;
    return c.html(page("Alt Detected", body, "#e74c3c"));
});

app.get("/mobile", (c) => {
    const body = `
        <div class="server-name">Nexus</div>
        <div class="icon">&#128241;</div>
        <div class="title" style="color:#f39c12">Mobile Data Detected</div>
        <div class="subtitle">Verification over mobile data is not permitted. Please connect to Wi-Fi and try again.</div>
    `;
    return c.html(page("Mobile Blocked", body, "#f39c12"));
});

app.get("/error", (c) => {
    const reason = c.req.query("reason") ?? "unknown";
    const body = `
        <div class="server-name">Nexus</div>
        <div class="icon">&#x2716;</div>
        <div class="title" style="color:#e74c3c">Something Went Wrong</div>
        <div class="subtitle">Verification failed: <code>${reason}</code>. Please try again or contact a staff member.</div>
    `;
    return c.html(page("Error", body, "#e74c3c"));
});

Deno.serve({ port: PORT, onListen: ({ port }) => console.log(`[HTTP] Verification server running on port ${port}`) }, app.fetch);

await client.login(TOKEN);
