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
        .setName("softban")
        .setDescription("Ban and immediately unban a member to delete their messages.")
        .addUserOption(o => o.setName("user").setDescription("The member to softban.").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the softban.").setRequired(false))
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const target = interaction.options.getMember("user") as GuildMember | null;
        const reason = interaction.options.getString("reason");
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        if (!target) return interaction.reply({ embeds: [buildErrorEmbed("User not found or not in the server.")], ephemeral });

        if (!target.bannable) return interaction.reply({ embeds: [buildErrorEmbed("I cannot softban this user. They may have a higher role than me.")], ephemeral });

        const member = interaction.member as GuildMember;
        if (target.roles.highest.position >= member.roles.highest.position) {
            return interaction.reply({ embeds: [buildErrorEmbed("You cannot softban someone with an equal or higher role.")], ephemeral });
        }

        await dmUser(target.user, interaction.guild, "Softban", reason);
        await target.ban({ reason: reason ?? undefined, deleteMessageSeconds: 604800 });
        await interaction.guild.bans.remove(target.id, "Softban — immediate unban");

        await sendModLog(interaction.guild, { action: "Softban", target: target.user, moderator: interaction.user, reason });

        await interaction.reply({
            embeds: [buildSuccessEmbed(`**${target.user.tag}** has been softbanned.`)],
            ephemeral,
        });
    },
} satisfies Command;
