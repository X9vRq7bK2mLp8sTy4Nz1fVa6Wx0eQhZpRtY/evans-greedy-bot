import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    type GuildMember,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildSuccessEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { sendModLog, dmUser } from "../utils/modlog.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member from the server.")
        .addUserOption(o => o.setName("user").setDescription("The member to kick.").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the kick.").setRequired(false))
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const target = interaction.options.getMember("user") as GuildMember | null;
        const reason = interaction.options.getString("reason");
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        if (!target) return interaction.reply({ embeds: [buildErrorEmbed("User not found or not in the server.")], ephemeral });

        if (!target.kickable) return interaction.reply({ embeds: [buildErrorEmbed("I cannot kick this user. They may have a higher role than me.")], ephemeral });

        const member = interaction.member as GuildMember;
        if (target.roles.highest.position >= member.roles.highest.position) {
            return interaction.reply({ embeds: [buildErrorEmbed("You cannot kick someone with an equal or higher role.")], ephemeral });
        }

        await dmUser(target.user, interaction.guild, "Kick", reason);
        await target.kick(reason ?? undefined);

        await sendModLog(interaction.guild, { action: "Kick", target: target.user, moderator: interaction.user, reason });

        await interaction.reply({
            embeds: [buildSuccessEmbed(`**${target.user.tag}** has been kicked.`)],
            ephemeral,
        });
    },
} satisfies Command;
