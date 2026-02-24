import {
    SlashCommandBuilder,
    EmbedBuilder,
    type ChatInputCommandInteraction,
    type GuildMember,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";

const COLOUR = 0x4f59c1;

const KEY_PERMISSIONS = [
    "Administrator",
    "ManageGuild",
    "ManageRoles",
    "ManageChannels",
    "ManageMessages",
    "ManageWebhooks",
    "ManageNicknames",
    "ManageEmojisAndStickers",
    "KickMembers",
    "BanMembers",
    "MentionEveryone",
    "ModerateMembers",
];

export default {
    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("View detailed information about a member.")
        .addUserOption(o => o.setName("user").setDescription("The member to inspect. Defaults to yourself.").setRequired(false))
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const target = (interaction.options.getMember("user") as GuildMember | null) ?? interaction.member as GuildMember;
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        if (!target) return interaction.reply({ embeds: [buildErrorEmbed("User not found.")], ephemeral });

        const roles = target.roles.cache
            .filter(r => r.id !== interaction.guild!.id)
            .sort((a, b) => b.position - a.position)
            .map(r => `<@&${r.id}>`)
            .join(", ") || "None";

        const sortedMembers = [...interaction.guild.members.cache.values()]
            .sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0));
        const joinPosition = sortedMembers.findIndex(m => m.id === target.id) + 1;

        const perms = target.permissions.toArray()
            .filter(p => KEY_PERMISSIONS.includes(p))
            .join(", ") || "None";

        const createdAt = `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`;
        const joinedAt = target.joinedTimestamp
            ? `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`
            : "Unknown";

        const embed = new EmbedBuilder()
            .setColor(target.displayColor || COLOUR)
            .setAuthor({ name: target.user.tag, iconURL: target.user.displayAvatarURL() })
            .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: "ID", value: target.id, inline: true },
                { name: "Nickname", value: target.nickname ?? "None", inline: true },
                { name: "Join Position", value: `#${joinPosition}`, inline: true },
                { name: "Account Created", value: createdAt, inline: true },
                { name: "Joined Server", value: joinedAt, inline: true },
                { name: "Highest Role", value: `<@&${target.roles.highest.id}>`, inline: true },
                { name: `Roles [${target.roles.cache.size - 1}]`, value: roles.length > 1024 ? roles.slice(0, 1020) + "..." : roles, inline: false },
                { name: "Key Permissions", value: perms, inline: false },
            )
            .setFooter({ text: "Nexus" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral });
    },
} satisfies Command;
