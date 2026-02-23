import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { getGuildConfig, upsertGuildConfig } from "../db/mongo.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("set-verified-role")
        .setDescription("Set the role automatically granted to users after they verify.")
        .addRoleOption(opt =>
            opt.setName("role")
                .setDescription("The role to grant upon successful verification.")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const role = interaction.options.getRole("role", true);

        const current = await getGuildConfig(interaction.guildId!);
        const existing = current?.memberRoleIds ?? [];

        if (!existing.includes(role.id)) {
            await upsertGuildConfig(interaction.guildId!, {
                memberRoleIds: [...existing, role.id],
            });
        }

        return interaction.reply({
            embeds: [buildEmbed({
                title: "Verified Role Set",
                description:
                    `>>> Users who complete verification will now receive <@&${role.id}> (**${role.name}**).\n\n` +
                    `**Total verified roles configured:** ${[...existing, role.id].filter((v, i, a) => a.indexOf(v) === i).length}`,
                timestamp: true,
            })],
            ephemeral: true,
        });
    },
} satisfies Command;
