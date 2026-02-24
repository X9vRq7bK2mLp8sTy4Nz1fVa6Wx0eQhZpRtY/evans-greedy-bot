import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildSuccessEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { sendModLog } from "../utils/modlog.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user from the server.")
        .addStringOption(o => o.setName("user-id").setDescription("The user ID to unban.").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the unban.").setRequired(false))
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const userId = interaction.options.getString("user-id", true);
        const reason = interaction.options.getString("reason");
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        const bans = await interaction.guild.bans.fetch();
        const ban = bans.get(userId);
        if (!ban) return interaction.reply({ embeds: [buildErrorEmbed("That user is not banned.")], ephemeral });

        await interaction.guild.bans.remove(userId, reason ?? undefined);

        await sendModLog(interaction.guild, { action: "Unban", target: ban.user, moderator: interaction.user, reason });

        await interaction.reply({
            embeds: [buildSuccessEmbed(`**${ban.user.tag}** has been unbanned.`)],
            ephemeral,
        });
    },
} satisfies Command;
