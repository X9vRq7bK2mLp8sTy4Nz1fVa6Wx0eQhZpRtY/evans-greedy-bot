const UNITS: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
};

export function parseDuration(input: string): number | null {
    const match = input.match(/^(\d+)\s*([smhdw])$/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (!UNITS[unit] || value <= 0) return null;
    return value * UNITS[unit];
}

export function formatDuration(ms: number): string {
    if (ms >= 86_400_000) return `${Math.floor(ms / 86_400_000)}d`;
    if (ms >= 3_600_000) return `${Math.floor(ms / 3_600_000)}h`;
    if (ms >= 60_000) return `${Math.floor(ms / 60_000)}m`;
    return `${Math.floor(ms / 1000)}s`;
}
