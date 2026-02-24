import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    type ChatInputCommandInteraction,
    type TextChannel,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { getGuildConfig } from "../db/mongo.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("cant-talk")
        .setDescription("Lock a channel for verified and/or unverified members.")
        .addStringOption(opt =>
            opt.setName("lock")
                .setDescription("Who should be restricted from talking?")
                .setRequired(false)
                .addChoices(
                    { name: "All members", value: "all" },
                    { name: "Verified members only", value: "verified" },
                    { name: "Unverified members only", value: "unverified" }
                )
        )
        .addStringOption(opt =>
            opt.setName("hide")
                .setDescription("Who should be unable to VIEW the channel?")
                .setRequired(false)
                .addChoices(
                    { name: "Nobody (Everyone can see)", value: "none" },
                    { name: "Verified members", value: "verified" },
                    { name: "Unverified members", value: "unverified" },
                    { name: "Both", value: "both" }
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const lockTarget = interaction.options.getString("lock") || "all";
        const hideTarget = interaction.options.getString("hide") || "none";

        const config = await getGuildConfig(interaction.guildId!);
        if (!config) return interaction.reply({ embeds: [buildErrorEmbed("Server configuration not found.")], ephemeral: true });

        const channel = interaction.channel as TextChannel;
        const verifiedRoles = config.memberRoleIds || [];
        const unverifiedRole = config.unverifiedRoleId;

        const allRoles = [...verifiedRoles];
        if (unverifiedRole) allRoles.push(unverifiedRole);

        if (allRoles.length === 0) {
            return interaction.reply({ embeds: [buildErrorEmbed("No configured roles found to lock.")], ephemeral: true });
        }

        try {
            for (const roleId of allRoles) {
                const isVerified = verifiedRoles.includes(roleId);
                const isUnverified = roleId === unverifiedRole;

                // Determine if this role should be hidden
                let canView = true;
                if (hideTarget === "both") canView = false;
                else if (hideTarget === "verified" && isVerified) canView = false;
                else if (hideTarget === "unverified" && isUnverified) canView = false;

                // Determine if this role should be locked (can't talk)
                let canTalk = true;
                if (lockTarget === "all") canTalk = false;
                else if (lockTarget === "verified" && isVerified) canTalk = false;
                else if (lockTarget === "unverified" && isUnverified) canTalk = false;

                await channel.permissionOverwrites.edit(roleId, {
                    ViewChannel: canView,
                    SendMessages: canTalk,
                    AddReactions: canTalk,
                    CreatePublicThreads: canTalk,
                    CreatePrivateThreads: canTalk,
                    SendMessagesInThreads: canTalk,
                });
            }

            return interaction.reply({
                embeds: [buildEmbed({
                    title: "Channel Permissions Updated",
                    description: `>>> **Lock Target:** ${lockTarget}\n**Hidden From:** ${hideTarget}`,
                    timestamp: true,
                })],
            });
        } catch (err) {
            return interaction.reply({ embeds: [buildErrorEmbed(`Failed to update permissions: ${(err as Error).message}`)], ephemeral: true });
        }
    },
} satisfies Command;
