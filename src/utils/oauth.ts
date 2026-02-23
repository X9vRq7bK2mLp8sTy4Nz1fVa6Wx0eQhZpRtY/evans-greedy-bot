export async function getToken(authCode: string): Promise<string> {
    const clientId = Deno.env.get("DISCORD_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET") || "";
    const redirectUri = `https://verification.rawth.net/callback`;

    const res = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: authCode,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            scope: "identify",
        }).toString(),
    });
    const data = await res.json();
    return data.access_token;
}

export async function getUserData(token: string): Promise<{ id: string; username: string }> {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${token}` },
    });
    return await res.json();
}

export async function invalidateToken(accessToken: string): Promise<void> {
    const clientId = Deno.env.get("DISCORD_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET") || "";
    await fetch("https://discord.com/api/oauth2/token/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            token: accessToken,
        }),
    });
}

export function buildOAuthUrl(clientId: string, state?: string): string {
    const base = "https://discord.com/api/oauth2/authorize";
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: `https://verification.rawth.net/callback`,
        scope: "identify",
    });
    if (state) params.set("state", state);
    return `${base}?${params.toString()}`;
}
