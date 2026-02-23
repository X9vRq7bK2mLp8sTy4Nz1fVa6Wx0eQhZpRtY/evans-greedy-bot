import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    PermissionFlagsBits,
    AttachmentBuilder,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildEmbed, buildErrorEmbed, getPngPath, getPngFileName } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("embed")
        .setDescription("Send a custom embed to a channel.")
        .addStringOption(opt =>
            opt.setName("title")
                .setDescription("The title of the embed.")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("description")
                .setDescription("The description/body of the embed.")
                .setRequired(true)
        )
        .addChannelOption(opt =>
            opt.setName("channel")
                .setDescription("The channel to send the embed to (defaults to current).")
                .setRequired(false)
        )
        .addBooleanOption(opt =>
            opt.setName("thumbnail")
                .setDescription("Attach the server logo thumbnail? (Default: true)")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);

        const title = interaction.options.getString("title", true);
        const description = interaction.options.getString("description", true);
        const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as any;
        const useThumbnail = interaction.options.getBoolean("thumbnail") ?? true;

        if (!channel?.send) {
            return interaction.reply({ embeds: [buildErrorEmbed("Invalid target channel.")], ephemeral: true });
        }

        const embed = buildEmbed({
            title,
            description: `>>> ${description}`,
            thumbnail: useThumbnail,
            timestamp: true,
        });

        const files: AttachmentBuilder[] = useThumbnail
            ? [new AttachmentBuilder(getPngPath(), { name: getPngFileName() })]
            : [];

        await channel.send({ embeds: [embed], files });

        return interaction.reply({
            embeds: [buildEmbed({ description: `>>> Embed sent to <#${channel.id}>.` })],
            ephemeral: true,
        });
    },
} satisfies Command;
