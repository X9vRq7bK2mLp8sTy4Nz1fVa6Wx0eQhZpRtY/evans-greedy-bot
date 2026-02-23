import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { getGuildConfig } from "../db/mongo.ts";

const SUPER_ADMIN_ID = "1380933421416714410";

export async function isAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (interaction.user.id === SUPER_ADMIN_ID) return true;
    const member = interaction.member as GuildMember;
    if (!member) return false;
    if (member.permissions.has("ManageGuild")) return true;
    const config = await getGuildConfig(interaction.guildId!);
    if (!config?.adminRoleId) return false;
    return member.roles.cache.has(config.adminRoleId);
}

export async function replyNoAdmin(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
        embeds: [
            {
                color: 0xe74c3c,
                description: ">>> You do not have permission to use this command.",
                footer: { text: "Nexus" },
            } as any,
        ],
        ephemeral: true,
    });
}
