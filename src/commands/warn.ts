import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    type GuildMember,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildSuccessEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { sendModLog, dmUser } from "../utils/modlog.ts";
import { addWarning, getWarnings } from "../db/mongo.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Issue a warning to a member.")
        .addUserOption(o => o.setName("user").setDescription("The member to warn.").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the warning.").setRequired(true))
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const target = interaction.options.getMember("user") as GuildMember | null;
        const reason = interaction.options.getString("reason", true);
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        if (!target) return interaction.reply({ embeds: [buildErrorEmbed("User not found or not in the server.")], ephemeral });

        if (target.user.bot) return interaction.reply({ embeds: [buildErrorEmbed("You cannot warn a bot.")], ephemeral });

        await addWarning({
            guildId: interaction.guildId!,
            userId: target.id,
            userTag: target.user.tag,
            modId: interaction.user.id,
            modTag: interaction.user.tag,
            reason,
            createdAt: new Date(),
        });

        const allWarnings = await getWarnings(interaction.guildId!, target.id);

        await dmUser(target.user, interaction.guild, "Warn", reason);

        await sendModLog(interaction.guild, {
            action: "Warn",
            target: target.user,
            moderator: interaction.user,
            reason,
            extra: `**Total Warnings:** ${allWarnings.length}`,
        });

        await interaction.reply({
            embeds: [buildSuccessEmbed(`**${target.user.tag}** has been warned. They now have **${allWarnings.length}** warning(s).`)],
            ephemeral,
        });
    },
} satisfies Command;
