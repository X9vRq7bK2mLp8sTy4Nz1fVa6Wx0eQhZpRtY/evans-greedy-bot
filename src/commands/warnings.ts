import {
    SlashCommandBuilder,
    EmbedBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { getWarnings } from "../db/mongo.ts";

const COLOUR = 0x4f59c1;

export default {
    data: new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View warnings for a user.")
        .addUserOption(o => o.setName("user").setDescription("The user to check warnings for.").setRequired(true))
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const user = interaction.options.getUser("user", true);
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        const warns = await getWarnings(interaction.guildId!, user.id);

        if (warns.length === 0) {
            return interaction.reply({ embeds: [buildErrorEmbed(`**${user.tag}** has no warnings.`)], ephemeral });
        }

        const lines = warns.slice(0, 25).map((w, i) => {
            const date = new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            return `**${i + 1}.** ${w.reason}\n↳ By <@${w.modId}> — ${date}`;
        });

        const embed = new EmbedBuilder()
            .setColor(COLOUR)
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
            .setDescription(`>>> ${lines.join("\n\n")}`)
            .setFooter({ text: `${warns.length} warning(s) total · Nexus` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral });
    },
} satisfies Command;
