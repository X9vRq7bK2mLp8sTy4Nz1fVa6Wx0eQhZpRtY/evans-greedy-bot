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
        .setName("ban")
        .setDescription("Ban a member from the server.")
        .addUserOption(o => o.setName("user").setDescription("The member to ban.").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the ban.").setRequired(false))
        .addStringOption(o => o.setName("duration").setDescription("Temporary ban duration (e.g. 1d, 12h, 30m).").setRequired(false))
        .addBooleanOption(o => o.setName("visible").setDescription("Show response publicly.").setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const target = interaction.options.getMember("user") as GuildMember | null;
        const reason = interaction.options.getString("reason");
        const durationStr = interaction.options.getString("duration");
        const visible = interaction.options.getBoolean("visible") ?? true;
        const ephemeral = !visible;

        if (!target) return interaction.reply({ embeds: [buildErrorEmbed("User not found or not in the server.")], ephemeral });

        if (!target.bannable) return interaction.reply({ embeds: [buildErrorEmbed("I cannot ban this user. They may have a higher role than me.")], ephemeral });

        const member = interaction.member as GuildMember;
        if (target.roles.highest.position >= member.roles.highest.position) {
            return interaction.reply({ embeds: [buildErrorEmbed("You cannot ban someone with an equal or higher role.")], ephemeral });
        }

        let duration: number | null = null;
        if (durationStr) {
            duration = parseDuration(durationStr);
            if (!duration) return interaction.reply({ embeds: [buildErrorEmbed("Invalid duration format. Use e.g. `10m`, `2h`, `1d`.")], ephemeral });
        }

        await dmUser(target.user, interaction.guild, "Ban", reason);
        await target.ban({ reason: reason ?? undefined, deleteMessageSeconds: 604800 });

        const extra = duration ? `**Duration:** ${formatDuration(duration)}` : null;
        await sendModLog(interaction.guild, { action: "Ban", target: target.user, moderator: interaction.user, reason, extra });

        if (duration) {
            setTimeout(async () => {
                await interaction.guild!.bans.remove(target.id, "Temp ban expired").catch(() => { });
            }, duration);
        }

        await interaction.reply({
            embeds: [buildSuccessEmbed(`**${target.user.tag}** has been banned.${duration ? ` (${formatDuration(duration)})` : ""}`)],
            ephemeral,
        });
    },
} satisfies Command;
