import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildSuccessEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { sendModLog } from "../utils/modlog.ts";
import { clearUserWarnings, clearAllWarnings } from "../db/mongo.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("clearwarnings")
        .setDescription("Clear warnings for a user or the entire server.")
        .addUserOption(o => o.setName("user").setDescription("The user to clear warnings for. Omit to clear all (owner only).").setRequired(false))
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const user = interaction.options.getUser("user");
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        if (!user) {
            if (interaction.user.id !== interaction.guild.ownerId) {
                return interaction.reply({ embeds: [buildErrorEmbed("Only the server owner can clear all warnings.")], ephemeral });
            }

            const count = await clearAllWarnings(interaction.guildId!);

            await sendModLog(interaction.guild, {
                action: "Clear Warnings",
                target: interaction.user,
                moderator: interaction.user,
                reason: `Cleared all ${count} warning(s) server-wide`,
            });

            return interaction.reply({
                embeds: [buildSuccessEmbed(`Cleared **${count}** warning(s) for the entire server.`)],
                ephemeral,
            });
        }

        const count = await clearUserWarnings(interaction.guildId!, user.id);

        if (count === 0) {
            return interaction.reply({ embeds: [buildErrorEmbed(`**${user.tag}** has no warnings to clear.`)], ephemeral });
        }

        await sendModLog(interaction.guild, {
            action: "Clear Warnings",
            target: user,
            moderator: interaction.user,
            reason: `Cleared ${count} warning(s)`,
        });

        await interaction.reply({
            embeds: [buildSuccessEmbed(`Cleared **${count}** warning(s) for **${user.tag}**.`)],
            ephemeral,
        });
    },
} satisfies Command;
