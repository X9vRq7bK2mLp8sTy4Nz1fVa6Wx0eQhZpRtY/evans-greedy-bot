import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { setVerified, checkVerified, hashIp } from "../db/mongo.ts";
import { grantRole, logEmbedWebhook, buildLogEmbed } from "../utils/discord.ts";
import { getGuildConfig } from "../db/mongo.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("manverify")
        .setDescription("Manually verify a user by their IP address.")
        .addUserOption(opt =>
            opt.setName("user")
                .setDescription("The user to verify.")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("ip")
                .setDescription("The IP address to associate with this user.")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const user = interaction.options.getUser("user", true);
        const ip = interaction.options.getString("ip", true);

        const ipHash = hashIp(ip);
        const existing = await checkVerified(ipHash);

        if (existing && existing.userId !== user.id) {
            return interaction.reply({
                embeds: [buildErrorEmbed(
                    `This IP is already registered to <@${existing.userId}>.\n\nIf you want to override this, delete the existing record first.`
                )],
                ephemeral: true,
            });
        }

        const config = await getGuildConfig(interaction.guildId!);
        const memberRoles = config?.memberRoleIds ?? [];

        await setVerified(user.id, ip);

        if (memberRoles.length > 0) {
            await grantRole(interaction.guild, user.id, memberRoles);
        }

        await logEmbedWebhook(interaction.client, buildLogEmbed(
            "Manual Verification",
            `<@${user.id}> was manually verified by <@${interaction.user.id}>.\n\n**IP Recorded:** \`[hashed]\``,
        ));

        return interaction.reply({
            embeds: [buildEmbed({
                title: "User Verified",
                description: `>>> <@${user.id}> has been manually verified.\n\n**Verified by:** <@${interaction.user.id}>\n**IP recorded:** \`[stored securely]\``,
                fields: memberRoles.length > 0 ? [{ name: "Roles Granted", value: memberRoles.map(r => `<@&${r}>`).join(", ") }] : [],
                timestamp: true,
            })],
        });
    },
} satisfies Command;
