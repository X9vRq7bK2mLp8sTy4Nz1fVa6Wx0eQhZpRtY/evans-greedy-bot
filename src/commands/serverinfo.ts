import {
    SlashCommandBuilder,
    EmbedBuilder,
    type ChatInputCommandInteraction,
    ChannelType,
} from "discord.js";
import type { Command } from "../types.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";

const COLOUR = 0x4f59c1;

const BOOST_TIERS: Record<number, string> = {
    0: "None",
    1: "Tier 1",
    2: "Tier 2",
    3: "Tier 3",
};

const VERIFICATION_LEVELS: Record<number, string> = {
    0: "None",
    1: "Low",
    2: "Medium",
    3: "High",
    4: "Very High",
};

export default {
    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("View detailed information about the server.")
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;
        const guild = interaction.guild;

        const owner = await guild.fetchOwner();
        const channels = guild.channels.cache;
        const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
        const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;

        const createdAt = `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`;

        const embed = new EmbedBuilder()
            .setColor(COLOUR)
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() ?? undefined })
            .setThumbnail(guild.iconURL({ size: 256 }))
            .addFields(
                { name: "Owner", value: `${owner.user.tag}`, inline: true },
                { name: "Members", value: `${guild.memberCount}`, inline: true },
                { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
                { name: "Text Channels", value: `${textChannels}`, inline: true },
                { name: "Voice Channels", value: `${voiceChannels}`, inline: true },
                { name: "Categories", value: `${categories}`, inline: true },
                { name: "Boost Level", value: BOOST_TIERS[guild.premiumTier] ?? "Unknown", inline: true },
                { name: "Boosts", value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
                { name: "Verification Level", value: VERIFICATION_LEVELS[guild.verificationLevel] ?? "Unknown", inline: true },
                { name: "Created", value: createdAt, inline: true },
                { name: "Server ID", value: guild.id, inline: true },
            )
            .setFooter({ text: "Nexus" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral });
    },
} satisfies Command;
