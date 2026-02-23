import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { getGuildConfig, upsertGuildConfig } from "../db/mongo.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("welcome")
        .setDescription("Configure the welcome message system.")
        .addSubcommand(sub =>
            sub.setName("set")
                .setDescription("Set the channel where welcome messages are sent.")
                .addChannelOption(opt =>
                    opt.setName("channel")
                        .setDescription("The channel to send welcome messages in.")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("disable")
                .setDescription("Disable welcome messages.")
        )
        .addSubcommand(sub =>
            sub.setName("status")
                .setDescription("Show the current welcome channel configuration.")
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const sub = interaction.options.getSubcommand();

        if (sub === "set") {
            const channel = interaction.options.getChannel("channel", true);
            await upsertGuildConfig(interaction.guildId!, { welcomeChannelId: channel.id });
            return interaction.reply({
                embeds: [buildEmbed({
                    title: "Welcome Channel Set",
                    description: `>>> Welcome messages will now be sent to <#${channel.id}> (**${channel.name}**) when new members join.`,
                    timestamp: true,
                })],
                ephemeral: true,
            });
        }

        if (sub === "disable") {
            await upsertGuildConfig(interaction.guildId!, { welcomeChannelId: undefined });
            return interaction.reply({
                embeds: [buildEmbed({
                    description: ">>> Welcome messages have been disabled.",
                    timestamp: true,
                })],
                ephemeral: true,
            });
        }

        if (sub === "status") {
            const config = await getGuildConfig(interaction.guildId!);
            const channelId = config?.welcomeChannelId;
            return interaction.reply({
                embeds: [buildEmbed({
                    title: "Welcome Status",
                    description: channelId
                        ? `>>> Welcome messages are **enabled**.\n\nCurrent channel: <#${channelId}>`
                        : ">>> Welcome messages are **disabled**. Use `/welcome set` to configure one.",
                    timestamp: true,
                })],
                ephemeral: true,
            });
        }
    },
} satisfies Command;
