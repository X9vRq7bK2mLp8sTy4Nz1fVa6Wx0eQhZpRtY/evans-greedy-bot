export async function getIpData(ip: string): Promise<{
    country: string;
    timezone: string;
    isp: string;
    org: string;
    as: string;
    asname: string;
    mobile: boolean;
    proxy: boolean;
    hosting: boolean;
    status: string;
}> {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=66842623`);
    const data = await res.json();
    return data;
}
