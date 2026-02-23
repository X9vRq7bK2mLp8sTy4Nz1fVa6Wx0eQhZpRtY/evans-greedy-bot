import type { Interaction, GuildMember, TextChannel } from "discord.js";
import { buildEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { createTicket, closeTicket, claimTicket, getOpenTicket } from "../tickets/manager.ts";
import { isAdmin } from "../utils/guards.ts";
import { getGuildConfig } from "../db/mongo.ts";

export default async function onInteractionCreate(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
        const client = interaction.client as any;
        const command = client.commands?.get(interaction.commandName);
        if (!command) {
            await interaction.reply({ content: "Unknown command.", ephemeral: true });
            return;
        }
        try {
            await command.execute(interaction);
        } catch (err) {
            console.error(`[CMD ERROR] ${interaction.commandName}:`, err);
            const errEmbed = buildErrorEmbed("An error occurred while executing this command.");
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errEmbed] }).catch(() => { });
            } else {
                await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => { });
            }
        }
        return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "set_admin_role_select") {
        return;
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;
        const guild = interaction.guild;
        if (!guild) return;

        if (customId === "ticket_open") {
            const member = interaction.member as GuildMember;
            await interaction.deferReply({ ephemeral: true });
            const channel = await createTicket(interaction.client, guild, member);
            if (!channel) {
                return interaction.editReply({
                    embeds: [buildErrorEmbed("You already have an open ticket.")],
                });
            }
            return interaction.editReply({
                embeds: [buildEmbed({ description: `>>> Ticket created: <#${channel.id}>` })],
            });
        }

        if (customId === "ticket_close") {
            const ticket = await getOpenTicket(interaction.channelId ?? "");
            if (!ticket) {
                return interaction.reply({ embeds: [buildErrorEmbed("This is not an active ticket.")], ephemeral: true });
            }

            const member = interaction.member as GuildMember;
            const adminCheck = await isAdmin(interaction as any);
            if (!adminCheck && ticket.userId !== interaction.user.id) {
                return interaction.reply({
                    embeds: [buildErrorEmbed("Only the ticket creator or an admin can close this ticket.")],
                    ephemeral: true,
                });
            }

            await interaction.reply({ embeds: [buildEmbed({ description: ">>> Closing this ticket in 5 seconds..." })] });
            await closeTicket(interaction.client, interaction.channel as TextChannel, member);
            return;
        }

        if (customId === "ticket_claim") {
            const ticket = await getOpenTicket(interaction.channelId ?? "");
            if (!ticket) {
                return interaction.reply({ embeds: [buildErrorEmbed("This is not an active ticket.")], ephemeral: true });
            }

            const config = await getGuildConfig(guild.id);
            const staffRoleId = config?.ticketStaffRoleId ?? config?.adminRoleId;
            const member = interaction.member as GuildMember;
            const isStaff = staffRoleId ? member.roles.cache.has(staffRoleId) : false;

            if (!isStaff && !(await isAdmin(interaction as any))) {
                return interaction.reply({ embeds: [buildErrorEmbed("Only staff members can claim tickets.")], ephemeral: true });
            }

            if (ticket.claimedBy) {
                return interaction.reply({
                    embeds: [buildErrorEmbed(`This ticket is already claimed by <@${ticket.claimedBy}>.`)],
                    ephemeral: true,
                });
            }

            await claimTicket(interaction.channelId!, interaction.user.id);
            return interaction.reply({
                embeds: [buildEmbed({
                    description: `>>> <@${interaction.user.id}> has claimed this ticket and will be your point of contact.`,
                    timestamp: true,
                })],
            });
        }

        if (customId === "ticket_transcript") {
            const adminCheck = await isAdmin(interaction as any);
            if (!adminCheck) {
                return interaction.reply({ embeds: [buildErrorEmbed("Only admins can generate transcripts via button.")], ephemeral: true });
            }
            const ticket = await getOpenTicket(interaction.channelId ?? "");
            if (!ticket) {
                return interaction.reply({ embeds: [buildErrorEmbed("No active ticket found.")], ephemeral: true });
            }
            const lines = [
                `=== NEXUS TICKET TRANSCRIPT ===`,
                `Ticket ID: ${ticket.channelId}`,
                `Opened by: ${ticket.userId}`,
                `Messages: ${ticket.messages.length}`,
                ``,
                ...ticket.messages.map(m => `[${new Date(m.timestamp).toISOString()}] ${m.authorTag}: ${m.content}`),
            ];
            const buffer = Buffer.from(lines.join("\n"), "utf-8");
            const { AttachmentBuilder } = await import("discord.js");
            const attachment = new AttachmentBuilder(buffer, { name: `transcript-${ticket.channelId}.txt` });
            return interaction.reply({
                embeds: [buildEmbed({ title: "Transcript", description: `>>> **${ticket.messages.length}** messages archived.`, timestamp: true })],
                files: [attachment],
                ephemeral: true,
            });
        }
    }
}
