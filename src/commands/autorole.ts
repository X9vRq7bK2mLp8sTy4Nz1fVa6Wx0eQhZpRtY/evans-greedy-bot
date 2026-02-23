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
        .setName("autorole")
        .setDescription("Configure the role automatically given to new members.")
        .addSubcommand(sub =>
            sub.setName("set")
                .setDescription("Set the auto-role given to new members.")
                .addRoleOption(opt =>
                    opt.setName("role")
                        .setDescription("The role to assign to new members.")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Remove the configured auto-role.")
        )
        .addSubcommand(sub =>
            sub.setName("status")
                .setDescription("Show the current auto-role configuration.")
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const sub = interaction.options.getSubcommand();

        if (sub === "set") {
            const role = interaction.options.getRole("role", true);
            await upsertGuildConfig(interaction.guildId!, { autoRoleId: role.id });
            return interaction.reply({
                embeds: [buildEmbed({
                    title: "Auto-Role Set",
                    description: `>>> Auto-role has been configured.\n\nNew members will automatically receive <@&${role.id}> (**${role.name}**) when they join.`,
                    timestamp: true,
                })],
                ephemeral: true,
            });
        }

        if (sub === "remove") {
            await upsertGuildConfig(interaction.guildId!, { autoRoleId: undefined });
            return interaction.reply({
                embeds: [buildEmbed({
                    description: ">>> Auto-role has been removed. New members will not receive a role on join.",
                    timestamp: true,
                })],
                ephemeral: true,
            });
        }

        if (sub === "status") {
            const config = await getGuildConfig(interaction.guildId!);
            const roleId = config?.autoRoleId;
            return interaction.reply({
                embeds: [buildEmbed({
                    title: "Auto-Role Status",
                    description: roleId
                        ? `>>> Auto-role is **enabled**.\n\nCurrent role: <@&${roleId}>`
                        : ">>> Auto-role is **disabled**. Use `/autorole set` to configure one.",
                    timestamp: true,
                })],
                ephemeral: true,
            });
        }
    },
} satisfies Command;
