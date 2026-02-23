import { MongoClient, Db, Collection } from "mongodb";
import type { GuildConfig, VerificationRecord, PendingDeletion, TicketRecord, AutoModApplied } from "../types.ts";

let client: MongoClient;
let db: Db;

export async function connectDB(): Promise<void> {
    const uri = Deno.env.get("MONGO_URI");
    if (!uri) throw new Error("MONGO_URI is not set");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("EVAN-BOT");
    console.log("[DB] Connected to MongoDB / EVAN-BOT");
}

export function getCollection<T extends object>(name: string): Collection<T> {
    return db.collection<T>(name);
}

export function configs(): Collection<GuildConfig> {
    return db.collection<GuildConfig>("configs");
}

export function verifications(): Collection<VerificationRecord> {
    return db.collection<VerificationRecord>("verifications");
}

export function pendingDeletions(): Collection<PendingDeletion> {
    return db.collection<PendingDeletion>("pendingDeletions");
}

export function tickets(): Collection<TicketRecord> {
    return db.collection<TicketRecord>("tickets");
}

export function automodApplied(): Collection<AutoModApplied> {
    return db.collection<AutoModApplied>("automodApplied");
}

export async function getGuildConfig(guildId: string): Promise<GuildConfig | null> {
    return await configs().findOne({ guildId });
}

export async function upsertGuildConfig(guildId: string, update: Partial<GuildConfig>): Promise<void> {
    await configs().updateOne(
        { guildId },
        { $set: { guildId, ...update } },
        { upsert: true }
    );
}

import { createHash } from "crypto";
export function hashIp(ip: string): string {
    const salt = Deno.env.get("IP_SALT") || "evan-bot-salt-2024";
    return createHash("sha256").update(salt + ip).digest("hex");
}

export async function checkVerified(ipHash: string): Promise<VerificationRecord | null> {
    return await verifications().findOne({ ipHash });
}

export async function setVerified(userId: string, ip: string): Promise<void> {
    const ipHash = hashIp(ip);
    await verifications().updateOne(
        { userId },
        { $set: { userId, ipHash, verifiedAt: new Date() } },
        { upsert: true }
    );
}

export async function deleteVerification(userId: string): Promise<void> {
    await verifications().deleteOne({ userId });
}

export async function addPendingDeletion(userId: string): Promise<void> {
    await pendingDeletions().updateOne(
        { userId },
        { $set: { userId, requestedAt: new Date() } },
        { upsert: true }
    );
}

export async function processPendingDeletions(): Promise<string[]> {
    const pending = await pendingDeletions().find({}).toArray();
    const ids = pending.map(p => p.userId);
    if (ids.length > 0) {
        await verifications().deleteMany({ userId: { $in: ids } });
        await pendingDeletions().deleteMany({});
    }
    return ids;
}

export async function closeDB(): Promise<void> {
    await client.close();
}
