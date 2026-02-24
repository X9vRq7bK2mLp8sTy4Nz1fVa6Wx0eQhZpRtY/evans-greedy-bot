import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    type TextChannel,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildSuccessEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Set the slowmode for the current channel.")
        .addIntegerOption(o =>
            o.setName("seconds")
                .setDescription("Slowmode interval in seconds (0 to disable, max 21600).")
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)
        )
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const seconds = interaction.options.getInteger("seconds", true);
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;
        const channel = interaction.channel as TextChannel;

        await channel.setRateLimitPerUser(seconds);

        const msg = seconds === 0
            ? "Slowmode has been disabled for this channel."
            : `Slowmode set to **${seconds}** second(s) for this channel.`;

        await interaction.reply({ embeds: [buildSuccessEmbed(msg)], ephemeral });
    },
} satisfies Command;
