import { EmbedBuilder } from "discord.js";
import { resolve } from "node:path";

const COLOUR = 0x4f59c1;
const FOOTER_TEXT = "Nexus";
const PNG_PATH = resolve(Deno.cwd(), "assets", "logo.png");

function pngAttachmentName(): string {
    return "logo.png";
}

export interface EmbedOptions {
    title?: string;
    description?: string;
    fields?: { name: string; value: string; inline?: boolean }[];
    thumbnail?: boolean;
    footer?: string;
    timestamp?: boolean;
}

export function buildEmbed(opts: EmbedOptions): EmbedBuilder {
    const e = new EmbedBuilder().setColor(COLOUR);
    if (opts.title) e.setTitle(opts.title);
    if (opts.description) e.setDescription(opts.description);
    if (opts.fields && opts.fields.length > 0) e.addFields(opts.fields);
    if (opts.thumbnail) e.setThumbnail(`attachment://${pngAttachmentName()}`);
    e.setFooter({ text: opts.footer ?? FOOTER_TEXT });
    if (opts.timestamp !== false) e.setTimestamp();
    return e;
}

export function buildErrorEmbed(description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(`>>> ${description}`)
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
}

export function buildSuccessEmbed(description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(COLOUR)
        .setDescription(`>>> ${description}`)
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
}

export function getPngPath(): string {
    return PNG_PATH;
}

export function getPngFileName(): string {
    return pngAttachmentName();
}
