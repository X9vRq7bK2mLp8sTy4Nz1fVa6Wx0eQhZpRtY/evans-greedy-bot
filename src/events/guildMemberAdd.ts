import type { GuildMember } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import { getGuildConfig } from "../db/mongo.ts";
import { grantRole, logEmbedWebhook, buildLogEmbed } from "../utils/discord.ts";
import { buildEmbed, getPngPath, getPngFileName } from "../utils/embed.ts";

export default async function onGuildMemberAdd(member: GuildMember) {
    const config = await getGuildConfig(member.guild.id);
    if (!config) return;

    if (config.autoRoleId) {
        await grantRole(member.guild, member.id, config.autoRoleId).catch(console.error);
    }

    if (config.welcomeChannelId) {
        const channel = member.guild.channels.cache.get(config.welcomeChannelId) as any;
        if (channel?.send) {
            const attachment = new AttachmentBuilder(getPngPath(), { name: getPngFileName() });
            const embed = buildEmbed({
                title: "Welcome to Nexus",
                description:
                    `>>> **${member.user.username}** has joined the server.\n\n` +
                    "**-** Head to the verification channel to gain full access.\n" +
                    "**-** Read the rules to understand our community standards.\n" +
                    "**-** Open a ticket if you need help from staff.",
                fields: [
                    { name: "Member Count", value: `${member.guild.memberCount}`, inline: true },
                    { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                ],
                thumbnail: true,
                timestamp: true,
            });
            await channel.send({ embeds: [embed], files: [attachment] }).catch(console.error);
        }
    }

    await logEmbedWebhook(member.client, buildLogEmbed(
        "Member Joined",
        `<@${member.id}> (**${member.user.tag}**) joined the server.\n\n` +
        (config.autoRoleId ? `Auto-role <@&${config.autoRoleId}> granted.` : "No auto-role configured."),
    )).catch(console.error);
}
