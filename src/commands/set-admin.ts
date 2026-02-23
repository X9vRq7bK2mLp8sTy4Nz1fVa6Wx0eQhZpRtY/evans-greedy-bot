import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { upsertGuildConfig } from "../db/mongo.ts";

const SUPER_ADMIN_ID = "1380933421416714410";

export default {
    data: new SlashCommandBuilder()
        .setName("set-admin")
        .setDescription("Set the admin role that can use all bot commands."),

    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as any;
        const hasPermission =
            interaction.user.id === SUPER_ADMIN_ID ||
            member?.permissions?.has(PermissionFlagsBits.ManageGuild);

        if (!hasPermission) {
            return interaction.reply({
                embeds: [buildErrorEmbed("You need **Manage Server** permission to use this command.")],
                ephemeral: true,
            });
        }

        if (!interaction.guild) {
            return interaction.reply({ embeds: [buildErrorEmbed("This command must be used in a server.")], ephemeral: true });
        }

        const roles = interaction.guild.roles.cache
            .filter(r => !r.managed && r.id !== interaction.guild!.roles.everyone.id)
            .sort((a, b) => b.position - a.position)
            .first(25);

        if (roles.length === 0) {
            return interaction.reply({ embeds: [buildErrorEmbed("No assignable roles found in this server.")], ephemeral: true });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("set_admin_role_select")
            .setPlaceholder("Select the admin role...")
            .addOptions(
                roles.map(role =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(role.name)
                        .setValue(role.id)
                        .setDescription(`Position: ${role.position}`)
                )
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        const embed = buildEmbed({
            title: "Set Admin Role",
            description:
                ">>> Select a role from the list below.\n" +
                "Members with this role will be able to use all bot commands.\n\n" +
                "**Note:** Users with **Manage Server** or the bot owner can always use admin commands regardless of this setting.",
            thumbnail: true,
        });

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

        const collector = interaction.channel?.createMessageComponentCollector({
            filter: i => i.customId === "set_admin_role_select" && i.user.id === interaction.user.id,
            time: 60_000,
            max: 1,
        });

        collector?.on("collect", async i => {
            const roleId = (i as any).values[0];
            const role = interaction.guild!.roles.cache.get(roleId);
            await upsertGuildConfig(interaction.guildId!, { adminRoleId: roleId });

            const successEmbed = buildEmbed({
                title: "Admin Role Updated",
                description: `>>> Admin role has been set to <@&${roleId}> (**${role?.name}**).\nMembers with this role can now use all bot commands.`,
                timestamp: true,
            });
            await i.update({ embeds: [successEmbed], components: [] });
        });

        collector?.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ embeds: [buildErrorEmbed("Selection timed out.")], components: [] }).catch(() => { });
            }
        });
    },
} satisfies Command;
