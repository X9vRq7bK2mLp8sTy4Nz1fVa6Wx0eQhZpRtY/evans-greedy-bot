import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    type GuildMember,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildSuccessEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { sendModLog } from "../utils/modlog.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Remove timeout from a member.")
        .addUserOption(o => o.setName("user").setDescription("The member to unmute.").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the unmute.").setRequired(false))
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const target = interaction.options.getMember("user") as GuildMember | null;
        const reason = interaction.options.getString("reason");
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        if (!target) return interaction.reply({ embeds: [buildErrorEmbed("User not found or not in the server.")], ephemeral });

        if (!target.isCommunicationDisabled()) {
            return interaction.reply({ embeds: [buildErrorEmbed("That user is not currently muted.")], ephemeral });
        }

        await target.timeout(null, reason ?? undefined);

        await sendModLog(interaction.guild, { action: "Unmute", target: target.user, moderator: interaction.user, reason });

        await interaction.reply({
            embeds: [buildSuccessEmbed(`**${target.user.tag}** has been unmuted.`)],
            ephemeral,
        });
    },
} satisfies Command;
