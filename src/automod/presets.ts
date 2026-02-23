export interface AutoModPreset {
    description: string;
    ruleName: string;
    keywordFilter: string[];
    regexPatterns: string[];
    allowedKeywords: string[];
}

export const PRESETS: Record<string, AutoModPreset> = {
    Low: {
        description: "Blocks obvious slurs and spam patterns. Minimal disruption.",
        ruleName: "EVAN-BOT: Low Security",
        keywordFilter: ["nigger", "nigga", "kys", "kill yourself", "go die", "faggot"],
        regexPatterns: ["(d[i1]sc[o0]rd\\.gg\\/\\w+)", "(bit\\.ly\\/\\S+)"],
        allowedKeywords: [],
    },
    Medium: {
        description: "Blocks hate speech, common invite links, and phishing terms.",
        ruleName: "EVAN-BOT: Medium Security",
        keywordFilter: [
            "nigger", "nigga", "kys", "kill yourself", "go die", "faggot",
            "free nitro", "click here", "claim your", "you have been selected",
            "discord token", "selfbot",
        ],
        regexPatterns: [
            "(d[i1]sc[o0]rd\\.gg\\/\\w+)",
            "(bit\\.ly\\/\\S+)",
            "(https?:\\/\\/(?!discord\\.com|discord\\.gg)\\S+\\.\\S+\\/\\S*(?:free|nitro|win|gift)\\S*)",
        ],
        allowedKeywords: ["discord.gg/nexus"],
    },
    High: {
        description: "Aggressive filtering. Blocks all external links, hate speech, and promotion.",
        ruleName: "EVAN-BOT: High Security",
        keywordFilter: [
            "nigger", "nigga", "kys", "kill yourself", "go die", "faggot",
            "free nitro", "click here", "claim your", "you have been selected",
            "discord token", "selfbot", "ip grabber", "ip logger", "booter",
            "stresser", "ratted", "remote access", "keylogger",
        ],
        regexPatterns: [
            "(d[i1]sc[o0]rd\\.gg\\/\\w+)",
            "(bit\\.ly\\/\\S+)",
            "(https?:\\/\\/(?!discord\\.com|discord\\.gg)\\S+\\.\\S+)",
            "([\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,})",
        ],
        allowedKeywords: ["discord.gg/nexus", "discord.com"],
    },
};
