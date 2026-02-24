import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    type ChatInputCommandInteraction,
    type Guild,
    AutoModerationActionType,
    AutoModerationRuleEventType,
    AutoModerationRuleTriggerType,
} from "discord.js";
import type { Command } from "../types.ts";
import { buildEmbed, buildErrorEmbed } from "../utils/embed.ts";
import { isAdmin, replyNoAdmin } from "../utils/guards.ts";
import { PRESETS } from "../automod/presets.ts";
import { automodApplied } from "../db/mongo.ts";

async function applyAutomodPreset(
    guild: Guild,
    presetName: string,
    logChannelId: string,
    exemptRoleIds: string[],
    exemptChannelIds: string[]
): Promise<void> {
    const preset = PRESETS[presetName];
    if (!preset) throw new Error(`Preset "${presetName}" not found`);

    const existing = await guild.autoModerationRules.fetch();
    const existingRule = existing.find(r => r.name === preset.ruleName);

    const actions = [
        { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: logChannelId } },
        { type: AutoModerationActionType.BlockMessage },
    ];

    const triggerMetadata = {
        keywordFilter: preset.keywordFilter,
        regexPatterns: preset.regexPatterns,
        allowList: preset.allowedKeywords,
    };

    if (existingRule) {
        await existingRule.edit({
            actions: actions as any,
            enabled: true,
            exemptRoles: exemptRoleIds,
            exemptChannels: exemptChannelIds,
            triggerMetadata: triggerMetadata as any,
        });
    } else {
        await guild.autoModerationRules.create({
            name: preset.ruleName,
            eventType: AutoModerationRuleEventType.MessageSend,
            triggerType: AutoModerationRuleTriggerType.Keyword,
            triggerMetadata: triggerMetadata as any,
            actions: actions as any,
            enabled: true,
            exemptRoles: exemptRoleIds,
            exemptChannels: exemptChannelIds,
        });
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName("automod")
        .setDescription("Manage Discord's native AutoMod configuration.")
        .addSubcommand(sub =>
            sub.setName("setup")
                .setDescription("Interactively set up AutoMod with a preset.")
                .addStringOption(opt =>
                    opt.setName("preset")
                        .setDescription("Security level preset to apply.")
                        .setRequired(true)
                        .addChoices(
                            { name: "Low - Basic slur/spam blocking", value: "Low" },
                            { name: "Medium - Hate speech + phishing protection", value: "Medium" },
                            { name: "High - Aggressive all-links + threat filtering", value: "High" }
                        )
                )
                .addChannelOption(opt =>
                    opt.setName("log-channel")
                        .setDescription("Channel to receive AutoMod alerts.")
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("exempt-roles")
                        .setDescription("Comma-separated role IDs to exempt from AutoMod.")
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName("exempt-channels")
                        .setDescription("Comma-separated channel IDs to exempt from AutoMod.")
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName("config")
                .setDescription("Show the current AutoMod configuration for this server.")
        )
        .addSubcommand(sub =>
            sub.setName("clear")
                .setDescription("Remove all bot-managed AutoMod rules from this server.")
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!await isAdmin(interaction)) return replyNoAdmin(interaction);
        if (!interaction.guild) return;

        const sub = interaction.options.getSubcommand();

        if (sub === "setup") {
            const presetName = interaction.options.getString("preset", true);
            const logChannel = interaction.options.getChannel("log-channel", true);
            const exemptRolesRaw = interaction.options.getString("exempt-roles") ?? "";
            const exemptChannelsRaw = interaction.options.getString("exempt-channels") ?? "";

            const exemptRoleIds = exemptRolesRaw
                ? exemptRolesRaw.split(",").map(s => s.trim()).filter(Boolean)
                : [];
            const exemptChannelIds = exemptChannelsRaw
                ? exemptChannelsRaw.split(",").map(s => s.trim()).filter(Boolean)
                : [];

            await interaction.deferReply({ ephemeral: true });

            try {
                await applyAutomodPreset(
                    interaction.guild,
                    presetName,
                    logChannel.id,
                    exemptRoleIds,
                    exemptChannelIds
                );

                await automodApplied().updateOne(
                    { guildId: interaction.guildId! },
                    { $set: { guildId: interaction.guildId!, presetName, appliedAt: new Date() } },
                    { upsert: true }
                );

                const preset = PRESETS[presetName];
                return interaction.editReply({
                    embeds: [buildEmbed({
                        title: "AutoMod Applied",
                        description: `>>> AutoMod rule **${preset.ruleName}** has been applied to this server.`,
                        fields: [
                            { name: "Preset", value: `>>> ${presetName}`, inline: true },
                            { name: "Log Channel", value: `>>> <#${logChannel.id}>`, inline: true },
                            { name: "Blocked Keywords", value: preset.keywordFilter.length > 0 ? `>>> \`${preset.keywordFilter.join("`, `")}\`` : ">>> None", inline: false },
                            { name: "Regex Patterns", value: preset.regexPatterns.length > 0 ? `>>> \`\`\`\n${preset.regexPatterns.join("\n")}\n\`\`\`` : ">>> None", inline: false },
                            { name: "Exempt Roles", value: exemptRoleIds.length > 0 ? `>>> ${exemptRoleIds.map(r => `<@&${r}>`).join(", ")}` : ">>> None", inline: true },
                            { name: "Exempt Channels", value: exemptChannelIds.length > 0 ? `>>> ${exemptChannelIds.map(c => `<#${c}>`).join(", ")}` : ">>> None", inline: true },
                        ],
                        timestamp: true,
                    })],
                });
            } catch (err) {
                return interaction.editReply({
                    embeds: [buildErrorEmbed(`Failed to apply AutoMod: ${(err as Error).message}`)],
                });
            }
        }

        if (sub === "config") {
            const applied = await automodApplied().findOne({ guildId: interaction.guildId! });
            if (!applied) {
                return interaction.reply({
                    embeds: [buildErrorEmbed("No AutoMod configuration has been applied by this bot. Use `/automod setup` to configure one.")],
                    ephemeral: true,
                });
            }
            const preset = PRESETS[applied.presetName];
            return interaction.reply({
                embeds: [buildEmbed({
                    title: "AutoMod Configuration",
                    fields: [
                        { name: "Preset", value: `>>> ${applied.presetName}`, inline: true },
                        { name: "Applied At", value: `>>> <t:${Math.floor(applied.appliedAt.getTime() / 1000)}:f>`, inline: true },
                        { name: "Description", value: `>>> ${preset?.description ?? "Unknown"}`, inline: false },
                        { name: "Blocked Keywords", value: preset?.keywordFilter.length > 0 ? `>>> \`${preset.keywordFilter.join("`, `")}\`` : ">>> None", inline: false },
                    ],
                    timestamp: true,
                })],
                ephemeral: true,
            });
        }

        if (sub === "clear") {
            await interaction.deferReply({ ephemeral: true });
            try {
                const allRules = await interaction.guild.autoModerationRules.fetch();
                const botRules = allRules.filter(r =>
                    Object.values(PRESETS).some(p => p.ruleName === r.name) && r.creatorId === interaction.client.user?.id
                );

                for (const rule of botRules.values()) {
                    await rule.delete("Cleared by /automod clear");
                }

                await automodApplied().deleteOne({ guildId: interaction.guildId! });

                return interaction.editReply({
                    embeds: [buildEmbed({
                        description: `>>> Removed **${botRules.size}** bot-managed AutoMod rule(s) from this server.`,
                        timestamp: true,
                    })],
                });
            } catch (err) {
                return interaction.editReply({
                    embeds: [buildErrorEmbed(`Failed to clear rules: ${(err as Error).message}`)],
                });
            }
        }
    },
} satisfies Command;
