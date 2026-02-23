import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    ChannelType,
    AttachmentBuilder,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildEmbed, buildErrorEmbed, getPngPath, getPngFileName } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { getGuildConfig, upsertGuildConfig, tickets } from "../db/mongo.ts";
import { createTicket, closeTicket, getOpenTicket } from "../tickets/manager.ts";
import type { GuildMember, TextChannel } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Manage the ticket system.")
        .addSubcommand(sub =>
            sub.setName("open")
                .setDescription("Open a support ticket.")
                .addStringOption(opt =>
                    opt.setName("topic")
                        .setDescription("Briefly describe your issue.")
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName("close")
                .setDescription("Close the current ticket channel.")
        )
        .addSubcommand(sub =>
            sub.setName("add")
                .setDescription("Add a user to the current ticket.")
                .addUserOption(opt =>
                    opt.setName("user")
                        .setDescription("The user to add.")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Remove a user from the current ticket.")
                .addUserOption(opt =>
                    opt.setName("user")
                        .setDescription("The user to remove.")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("transcript")
                .setDescription("Generate a transcript of the current ticket.")
        )
        .addSubcommand(sub =>
            sub.setName("setup")
                .setDescription("Configure ticket settings for this server.")
                .addChannelOption(opt =>
                    opt.setName("category")
                        .setDescription("The category channel for ticket channels.")
                        .setRequired(false)
                )
                .addRoleOption(opt =>
                    opt.setName("staff-role")
                        .setDescription("The role that can see and manage all tickets.")
                        .setRequired(false)
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        const sub = interaction.options.getSubcommand();

        if (sub === "open") {
            const topic = interaction.options.getString("topic") ?? undefined;
            const member = interaction.member as GuildMember;

            await interaction.deferReply({ ephemeral: true });

            const channel = await createTicket(interaction.client, interaction.guild, member, topic);

            if (!channel) {
                return interaction.editReply({
                    embeds: [buildErrorEmbed("You already have an open ticket. Please use your existing ticket channel.")],
                });
            }

            return interaction.editReply({
                embeds: [buildEmbed({
                    description: `>>> Your ticket has been created: <#${channel.id}>.`,
                    timestamp: true,
                })],
            });
        }

        if (sub === "close") {
            if (!await isAdmin(interaction) &&
                !(await getOpenTicket(interaction.channelId ?? ""))?.userId === interaction.user.id) {
                const ticket = await getOpenTicket(interaction.channelId ?? "");
                if (!ticket || ticket.userId !== interaction.user.id) {
                    return replyNoAdmin(interaction);
                }
            }

            const ticket = await getOpenTicket(interaction.channelId ?? "");
            if (!ticket) {
                return interaction.reply({
                    embeds: [buildErrorEmbed("This channel is not an active ticket.")],
                    ephemeral: true,
                });
            }

            await interaction.reply({
                embeds: [buildEmbed({ description: ">>> Closing this ticket in 5 seconds..." })],
            });

            await closeTicket(interaction.client, interaction.channel as TextChannel, interaction.member as GuildMember);
            return;
        }

        if (sub === "add") {
            if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
            const ticket = await getOpenTicket(interaction.channelId ?? "");
            if (!ticket) {
                return interaction.reply({ embeds: [buildErrorEmbed("This is not a ticket channel.")], ephemeral: true });
            }
            const user = interaction.options.getUser("user", true);
            await (interaction.channel as TextChannel).permissionOverwrites.edit(user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
            });
            return interaction.reply({
                embeds: [buildEmbed({ description: `>>> <@${user.id}> has been added to this ticket.`, timestamp: true })],
            });
        }

        if (sub === "remove") {
            if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
            const ticket = await getOpenTicket(interaction.channelId ?? "");
            if (!ticket) {
                return interaction.reply({ embeds: [buildErrorEmbed("This is not a ticket channel.")], ephemeral: true });
            }
            const user = interaction.options.getUser("user", true);
            if (user.id === ticket.userId) {
                return interaction.reply({ embeds: [buildErrorEmbed("You cannot remove the ticket creator.")], ephemeral: true });
            }
            await (interaction.channel as TextChannel).permissionOverwrites.edit(user.id, {
                ViewChannel: false,
            });
            return interaction.reply({
                embeds: [buildEmbed({ description: `>>> <@${user.id}> has been removed from this ticket.`, timestamp: true })],
            });
        }

        if (sub === "transcript") {
            if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
            const ticket = await getOpenTicket(interaction.channelId ?? "");
            if (!ticket) {
                return interaction.reply({ embeds: [buildErrorEmbed("This is not an active ticket. Only open tickets have live transcripts.")], ephemeral: true });
            }

            const lines: string[] = [
                `=== NEXUS TICKET TRANSCRIPT (LIVE) ===`,
                `Opened by: ${ticket.userId}`,
                `Opened at: ${ticket.createdAt.toISOString()}`,
                `Topic: ${ticket.topic ?? "N/A"}`,
                `Messages archived: ${ticket.messages.length}`,
                `======================================`,
                "",
                ...ticket.messages.map(m =>
                    `[${new Date(m.timestamp).toISOString()}] ${m.authorTag}: ${m.content}`
                ),
            ];

            const content = lines.join("\n");
            const encoder = new TextEncoder();
            const buffer = encoder.encode(content);
            const attachment = new AttachmentBuilder(Buffer.from(buffer), { name: `transcript-${ticket.channelId}.txt` });

            return interaction.reply({
                embeds: [buildEmbed({
                    title: "Ticket Transcript",
                    description: `>>> Live transcript for this ticket.\n**Messages:** ${ticket.messages.length}`,
                    timestamp: true,
                })],
                files: [attachment],
                ephemeral: true,
            });
        }

        if (sub === "setup") {
            if (!await isAdmin(interaction)) return replyNoAdmin(interaction);

            const category = interaction.options.getChannel("category");
            const staffRole = interaction.options.getRole("staff-role");

            const update: any = {};
            if (category) update.ticketCategoryId = category.id;
            if (staffRole) update.ticketStaffRoleId = staffRole.id;

            if (Object.keys(update).length === 0) {
                return interaction.reply({ embeds: [buildErrorEmbed("Please provide at least one setting to configure.")], ephemeral: true });
            }

            await upsertGuildConfig(interaction.guildId!, update);

            const fields = [];
            if (category) fields.push({ name: "Ticket Category", value: `<#${category.id}>`, inline: true });
            if (staffRole) fields.push({ name: "Staff Role", value: `<@&${staffRole.id}>`, inline: true });

            return interaction.reply({
                embeds: [buildEmbed({
                    title: "Ticket System Configured",
                    description: ">>> Ticket settings have been updated.",
                    fields,
                    timestamp: true,
                })],
                ephemeral: true,
            });
        }
    },
} satisfies Command;
