import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    type TextChannel,
    type Collection,
    type Message,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildSuccessEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { sendModLog } from "../utils/modlog.ts";

const LINK_REGEX = /https?:\/\/\S+/i;

async function fetchAndFilter(
    channel: TextChannel,
    count: number,
    filter?: (msg: Message) => boolean,
): Promise<Message[]> {
    const fetched = await channel.messages.fetch({ limit: Math.min(count, 100) });
    let messages = [...fetched.values()];

    if (filter) messages = messages.filter(filter);

    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return messages.filter(m => m.createdTimestamp > twoWeeksAgo && !m.pinned);
}

export default {
    data: new SlashCommandBuilder()
        .setName("purge")
        .setDescription("Bulk-delete messages from a channel.")
        .addSubcommand(sub =>
            sub.setName("any")
                .setDescription("Delete a number of messages.")
                .addIntegerOption(o => o.setName("count").setDescription("Number of messages to delete (1-100).").setRequired(true).setMinValue(1).setMaxValue(100))
                .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName("user")
                .setDescription("Delete messages from a specific user.")
                .addUserOption(o => o.setName("target").setDescription("The user whose messages to delete.").setRequired(true))
                .addIntegerOption(o => o.setName("count").setDescription("Number of messages to scan (1-100).").setRequired(true).setMinValue(1).setMaxValue(100))
                .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName("bots")
                .setDescription("Delete messages sent by bots.")
                .addIntegerOption(o => o.setName("count").setDescription("Number of messages to scan (1-100).").setRequired(true).setMinValue(1).setMaxValue(100))
                .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName("links")
                .setDescription("Delete messages containing links.")
                .addIntegerOption(o => o.setName("count").setDescription("Number of messages to scan (1-100).").setRequired(true).setMinValue(1).setMaxValue(100))
                .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName("images")
                .setDescription("Delete messages with attachments or embeds.")
                .addIntegerOption(o => o.setName("count").setDescription("Number of messages to scan (1-100).").setRequired(true).setMinValue(1).setMaxValue(100))
                .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName("match")
                .setDescription("Delete messages containing specific text.")
                .addStringOption(o => o.setName("text").setDescription("Text to match against.").setRequired(true))
                .addIntegerOption(o => o.setName("count").setDescription("Number of messages to scan (1-100).").setRequired(true).setMinValue(1).setMaxValue(100))
                .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false))
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const sub = interaction.options.getSubcommand();
        const count = interaction.options.getInteger("count", true);
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;
        const channel = interaction.channel as TextChannel;

        let filter: ((msg: Message) => boolean) | undefined;

        switch (sub) {
            case "user": {
                const target = interaction.options.getUser("target", true);
                filter = (m) => m.author.id === target.id;
                break;
            }
            case "bots":
                filter = (m) => m.author.bot;
                break;
            case "links":
                filter = (m) => LINK_REGEX.test(m.content);
                break;
            case "images":
                filter = (m) => m.attachments.size > 0 || m.embeds.length > 0;
                break;
            case "match": {
                const text = interaction.options.getString("text", true).toLowerCase();
                filter = (m) => m.content.toLowerCase().includes(text);
                break;
            }
        }

        const messages = await fetchAndFilter(channel, count, filter);

        if (messages.length === 0) {
            return interaction.reply({ embeds: [buildErrorEmbed("No messages found matching the criteria.")], ephemeral });
        }

        const deleted = await channel.bulkDelete(messages, true);

        await sendModLog(interaction.guild, {
            action: "Purge",
            target: interaction.user,
            moderator: interaction.user,
            reason: `Purged ${deleted.size} message(s) in #${channel.name}`,
            extra: `**Filter:** ${sub}`,
        });

        await interaction.reply({
            embeds: [buildSuccessEmbed(`Purged **${deleted.size}** message(s).`)],
            ephemeral,
        });
    },
} satisfies Command;
