import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    type GuildMember,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildSuccessEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("nick")
        .setDescription("Change a member's nickname.")
        .addUserOption(o => o.setName("user").setDescription("The member to rename.").setRequired(true))
        .addStringOption(o => o.setName("nickname").setDescription("The new nickname. Leave empty to reset.").setRequired(false))
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const target = interaction.options.getMember("user") as GuildMember | null;
        const nickname = interaction.options.getString("nickname");
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        if (!target) return interaction.reply({ embeds: [buildErrorEmbed("User not found or not in the server.")], ephemeral });

        if (!target.manageable) return interaction.reply({ embeds: [buildErrorEmbed("I cannot change this user's nickname. They may have a higher role than me.")], ephemeral });

        const oldNick = target.displayName;
        await target.setNickname(nickname ?? null);

        const msg = nickname
            ? `Changed **${oldNick}**'s nickname to **${nickname}**.`
            : `Reset **${oldNick}**'s nickname.`;

        await interaction.reply({ embeds: [buildSuccessEmbed(msg)], ephemeral });
    },
} satisfies Command;
