import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { upsertGuildConfig } from "../db/mongo.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("set-unverified-role")
        .setDescription("Set the role automatically granted to users when they join (replaced /autorole).")
        .addRoleOption(opt =>
            opt.setName("role")
                .setDescription("The role to grant to new members.")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const role = interaction.options.getRole("role", true);

        await upsertGuildConfig(interaction.guildId!, {
            unverifiedRoleId: role.id,
        });

        return interaction.reply({
            embeds: [buildEmbed({
                title: "Unverified Role Set",
                description: `>>> New members will now automatically receive <@&${role.id}> (**${role.name}**) upon joining.`,
                timestamp: true,
            })],
            ephemeral: true,
        });
    },
} satisfies Command;
