import {
    SlashCommandBuilder,
    ChannelType,
    type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildSuccessEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { upsertGuildConfig } from "../db/mongo.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("set-modlog")
        .setDescription("Set the channel for moderation action logs.")
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("The channel to send mod logs to.")
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const channel = interaction.options.getChannel("channel", true);
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        await upsertGuildConfig(interaction.guildId!, { modLogChannelId: channel.id });

        await interaction.reply({
            embeds: [buildSuccessEmbed(`Mod-log channel set to <#${channel.id}>.`)],
            ephemeral,
        });
    },
} satisfies Command;
