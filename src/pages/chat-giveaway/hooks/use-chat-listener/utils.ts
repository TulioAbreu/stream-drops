export function parseBadgeRaw(badgeInfoRaw: string) {
    const badgeInfo: Record<string, string> = {};

    const rawBadges = badgeInfoRaw.split(",");
    for (const badge of rawBadges) {
        const [key, value] = badge.split("/");
        if (key && value) {
            badgeInfo[key] = value;
        }
    }
    return badgeInfo;
}
