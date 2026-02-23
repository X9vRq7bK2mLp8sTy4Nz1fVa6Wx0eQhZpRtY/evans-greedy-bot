import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildEmbed, buildErrorEmbed, getPngPath, getPngFileName } from "../utils/embed.ts";
import { buildOAuthUrl } from "../utils/oauth.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { getGuildConfig } from "../db/mongo.ts";

const PANEL_TYPES = ["verification", "tickets", "rules", "information"] as const;

export default {
    data: new SlashCommandBuilder()
        .setName("send-panel")
        .setDescription("Send a panel embed with buttons to any channel.")
        .addStringOption(opt =>
            opt.setName("type")
                .setDescription("The type of panel to send.")
                .setRequired(true)
                .addChoices(
                    { name: "Verification", value: "verification" },
                    { name: "Tickets", value: "tickets" },
                    { name: "Rules", value: "rules" },
                    { name: "Information", value: "information" }
                )
        )
        .addChannelOption(opt =>
            opt.setName("channel")
                .setDescription("The channel to send the panel to (defaults to current channel).")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const type = interaction.options.getString("type", true);
        const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as any;

        if (!channel || !channel.send) {
            return interaction.reply({ embeds: [buildErrorEmbed("Invalid target channel.")], ephemeral: true });
        }

        const config = await getGuildConfig(interaction.guildId!);
        const clientId = Deno.env.get("DISCORD_CLIENT_ID") || "";
        const attachment = new AttachmentBuilder(getPngPath(), { name: getPngFileName() });

        if (type === "verification") {
            const oauthUrl = buildOAuthUrl(clientId);
            const embed = buildEmbed({
                title: "Server Verification",
                description:
                    ">>> Welcome to **Nexus**.\n\n" +
                    "To gain full access to the server, you must verify your account.\n\n" +
                    "**Process:**\n" +
                    "**1.** Click the button below\n" +
                    "**2.** Authorize with your Discord account\n" +
                    "**3.** Your access will be granted automatically\n\n" +
                    "**Why do we verify?**\n" +
                    "Verification protects our community from alt accounts and bad actors.",
                thumbnail: true,
                timestamp: true,
            });

            const verifyBtn = new ButtonBuilder()
                .setLabel("Verify Now")
                .setURL(oauthUrl)
                .setStyle(ButtonStyle.Link);
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(verifyBtn);

            await channel.send({ embeds: [embed], files: [attachment], components: [row] });

        } else if (type === "tickets") {
            const embed = buildEmbed({
                title: "Support Tickets",
                description:
                    ">>> Need help from the **Nexus** team?\n\n" +
                    "Click the button below to open a private support ticket.\n\n" +
                    "**Before opening a ticket, please:**\n" +
                    "**-** Check existing channels for your answer\n" +
                    "**-** Be ready to clearly explain your issue\n" +
                    "**-** Be patient — support staff will respond as soon as possible\n\n" +
                    "Abuse of the ticket system may result in a ban.",
                thumbnail: true,
                timestamp: true,
            });

            const ticketBtn = new ButtonBuilder()
                .setCustomId("ticket_open")
                .setLabel("Open Ticket")
                .setStyle(ButtonStyle.Primary);
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(ticketBtn);

            await channel.send({ embeds: [embed], files: [attachment], components: [row] });

        } else if (type === "rules") {
            const embed = buildEmbed({
                title: "Server Rules",
                description:
                    ">>> **Nexus — Community Rules**\n\n" +
                    "**1. Respect all members.**\n" +
                    "No harassment, hate speech, or targeted bullying.\n\n" +
                    "**2. No spam or flooding.**\n" +
                    "Keep messages relevant and avoid repeating yourself.\n\n" +
                    "**3. No advertising or self-promotion.**\n" +
                    "Do not post invite links or promote other servers.\n\n" +
                    "**4. No NSFW content.**\n" +
                    "This is a strict rule. Violations result in immediate bans.\n\n" +
                    "**5. No alt accounts.**\n" +
                    "Using alternate accounts to bypass bans will result in permanent removal.\n\n" +
                    "**6. Follow Discord's Terms of Service.**\n" +
                    "All users must abide by Discord's TOS at all times.\n\n" +
                    "Breaking these rules may result in warnings, mutes, kicks, or bans.",
                thumbnail: true,
                timestamp: true,
            });

            await channel.send({ embeds: [embed], files: [attachment] });

        } else if (type === "information") {
            const embed = buildEmbed({
                title: "Server Information",
                description:
                    ">>> **Welcome to Nexus**\n\n" +
                    "Nexus is a community server. Use the channels below to navigate:\n\n" +
                    "**Verification** — Verify your account to unlock full access\n" +
                    "**Tickets** — Reach out to staff privately\n" +
                    "**Announcements** — Stay up-to-date with server news\n\n" +
                    "If you have any questions, open a support ticket.",
                thumbnail: true,
                timestamp: true,
            });
            await channel.send({ embeds: [embed], files: [attachment] });
        }

        await interaction.reply({
            embeds: [buildEmbed({ description: `>>> Panel sent to <#${channel.id}>.`, timestamp: true })],
            ephemeral: true,
        });
    },
} satisfies Command;
