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
        .setName("role")
        .setDescription("Add or remove a role from a member.")
        .addSubcommand(sub =>
            sub.setName("add")
                .setDescription("Add a role to a member.")
                .addUserOption(o => o.setName("user").setDescription("The member.").setRequired(true))
                .addRoleOption(o => o.setName("role").setDescription("The role to add.").setRequired(true))
                .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Remove a role from a member.")
                .addUserOption(o => o.setName("user").setDescription("The member.").setRequired(true))
                .addRoleOption(o => o.setName("role").setDescription("The role to remove.").setRequired(true))
                .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false))
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getMember("user") as GuildMember | null;
        const role = interaction.options.getRole("role", true);
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        if (!target) return interaction.reply({ embeds: [buildErrorEmbed("User not found or not in the server.")], ephemeral });

        const botMember = interaction.guild.members.me;
        if (botMember && role.position >= botMember.roles.highest.position) {
            return interaction.reply({ embeds: [buildErrorEmbed("I cannot manage that role. It is equal to or higher than my highest role.")], ephemeral });
        }

        if (role.managed) {
            return interaction.reply({ embeds: [buildErrorEmbed("That role is managed by an integration and cannot be assigned manually.")], ephemeral });
        }

        if (sub === "add") {
            if (target.roles.cache.has(role.id)) {
                return interaction.reply({ embeds: [buildErrorEmbed(`**${target.user.tag}** already has the **${role.name}** role.`)], ephemeral });
            }
            await target.roles.add(role.id);
            await interaction.reply({ embeds: [buildSuccessEmbed(`Added **${role.name}** to **${target.user.tag}**.`)], ephemeral });
        } else {
            if (!target.roles.cache.has(role.id)) {
                return interaction.reply({ embeds: [buildErrorEmbed(`**${target.user.tag}** does not have the **${role.name}** role.`)], ephemeral });
            }
            await target.roles.remove(role.id);
            await interaction.reply({ embeds: [buildSuccessEmbed(`Removed **${role.name}** from **${target.user.tag}**.`)], ephemeral });
        }
    },
} satisfies Command;
