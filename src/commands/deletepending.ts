import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { processPendingDeletions } from "../db/mongo.ts";
import { removeRole } from "../utils/discord.ts";
import { getGuildConfig } from "../db/mongo.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("deletepending")
        .setDescription("Process all pending data deletion requests, removing roles from affected users."),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        await interaction.reply({
            embeds: [buildEmbed({
                title: "Processing Deletion Requests",
                description: ">>> Processing all pending data deletion requests...",
            })],
        });

        const ids = await processPendingDeletions();
        const config = await getGuildConfig(interaction.guildId!);
        const memberRoles = config?.memberRoleIds ?? [];

        let removed = 0;
        let notFound = 0;

        for (const userId of ids) {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (member && memberRoles.length > 0) {
                await member.roles.remove(memberRoles).catch(console.error);
                removed++;
            } else {
                notFound++;
            }
        }

        return interaction.editReply({
            embeds: [buildEmbed({
                title: "Deletion Requests Processed",
                description:
                    `>>> All pending data deletion requests have been processed.\n\n` +
                    `**Total Requests:** ${ids.length}\n` +
                    `**Roles Removed:** ${removed}\n` +
                    `**Not in Server:** ${notFound}`,
                timestamp: true,
            })],
        });
    },
} satisfies Command;
