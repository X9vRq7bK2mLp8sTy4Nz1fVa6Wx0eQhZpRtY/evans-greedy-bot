import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    type GuildMember,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildSuccessEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { sendModLog, dmUser } from "../utils/modlog.ts";
import { parseDuration, formatDuration } from "../utils/time.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Timeout a member so they cannot type or speak.")
        .addUserOption(o => o.setName("user").setDescription("The member to mute.").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("Timeout duration (e.g. 10m, 2h, 1d). Max 28d.").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the mute.").setRequired(false))
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const target = interaction.options.getMember("user") as GuildMember | null;
        const durationStr = interaction.options.getString("duration", true);
        const reason = interaction.options.getString("reason");
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        if (!target) return interaction.reply({ embeds: [buildErrorEmbed("User not found or not in the server.")], ephemeral });

        if (!target.moderatable) return interaction.reply({ embeds: [buildErrorEmbed("I cannot mute this user. They may have a higher role than me.")], ephemeral });

        const member = interaction.member as GuildMember;
        if (target.roles.highest.position >= member.roles.highest.position) {
            return interaction.reply({ embeds: [buildErrorEmbed("You cannot mute someone with an equal or higher role.")], ephemeral });
        }

        const duration = parseDuration(durationStr);
        if (!duration) return interaction.reply({ embeds: [buildErrorEmbed("Invalid duration format. Use e.g. `10m`, `2h`, `1d`.")], ephemeral });

        const maxTimeout = 28 * 24 * 60 * 60 * 1000;
        if (duration > maxTimeout) return interaction.reply({ embeds: [buildErrorEmbed("Maximum timeout duration is 28 days.")], ephemeral });

        await dmUser(target.user, interaction.guild, "Mute", reason);
        await target.timeout(duration, reason ?? undefined);

        const extra = `**Duration:** ${formatDuration(duration)}`;
        await sendModLog(interaction.guild, { action: "Mute", target: target.user, moderator: interaction.user, reason, extra });

        await interaction.reply({
            embeds: [buildSuccessEmbed(`**${target.user.tag}** has been muted for ${formatDuration(duration)}.`)],
            ephemeral,
        });
    },
} satisfies Command;
