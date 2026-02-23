import type { Message, TextChannel } from "discord.js";
import { getOpenTicket, addTicketMessage } from "../tickets/manager.ts";
import type { TicketMessage } from "../types.ts";

export default async function onMessageCreate(message: Message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const ticket = await getOpenTicket(message.channelId);
    if (!ticket) return;

    const ticketMsg: TicketMessage = {
        authorId: message.author.id,
        authorTag: message.author.tag,
        content: message.content.substring(0, 2000) || `[attachment: ${message.attachments.map(a => a.name).join(", ")}]`,
        timestamp: message.createdAt,
    };

    await addTicketMessage(message.channelId, ticketMsg).catch(console.error);
}
