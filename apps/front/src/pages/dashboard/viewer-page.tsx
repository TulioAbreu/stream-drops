import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Layout } from "@/components/layout";
import { RarityBadge } from "@/components/rarity-badge/rarity-badge";
import { ShellHeader } from "@/components/shell/shell-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { browserClock } from "@/components/giveaway/winner-badge-win";
import { useTranslation } from "@/i18n";
import type { ViewerStats } from "@/lib/winner-badges/stats";
import type { EngineClock, Rarity } from "@/lib/winner-badges/types";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/storage/settings";
import { currentYear, formatAbsolute, initials, monthName } from "./format";
import { buildViewerProfile, type ProfileAchievement } from "./model";
import { readDashboardSource, type DashboardSource } from "./source";
import { useDashboardSource } from "./use-dashboard-source";

const RARITY_KEY: Record<Rarity, string> = {
  common: "BADGES_RARITY_COMMON",
  uncommon: "BADGES_RARITY_UNCOMMON",
  rare: "BADGES_RARITY_RARE",
  epic: "BADGES_RARITY_EPIC",
  legendary: "BADGES_RARITY_LEGENDARY",
};

export type ViewerProfilePageProps = {
  clock?: EngineClock;
  loadSource?: () => Promise<DashboardSource>;
};

export function ViewerProfilePage({
  clock: clockProp,
  loadSource = readDashboardSource,
}: ViewerProfilePageProps) {
  const { t } = useTranslation();
  const params = useParams();
  const platform = params.platform ?? "";
  const userId = params.userId ?? "";
  const badgesEnabled = useSettingsStore((state) => state.badges.enabled);
  const [liveClock] = useState(browserClock);
  const clock = clockProp ?? liveClock;
  const { status, source } = useDashboardSource(loadSource);

  const profile = useMemo(() => {
    if (!source) return null;
    return buildViewerProfile(source, clock, platform, userId);
  }, [source, clock, platform, userId]);

  return (
    <Layout>
      <div data-viewer-profile data-dashboard-status={status}>
        <p className="mb-3">
          <Link to="/dashboard" className="text-sm font-semibold text-muted-foreground hover:underline">
            {t("DASHBOARD_PROFILE_BACK")}
          </Link>
        </p>
        {status === "loading" ? (
          <Skeleton className="h-[280px]" aria-busy="true" />
        ) : status === "error" || !source ? (
          <p className="text-sm text-muted-foreground">{t("DASHBOARD_LOAD_ERROR")}</p>
        ) : !profile ? (
          <>
            <ShellHeader
              section={t("DASHBOARD_PAGE_CRUMB_SECTION")}
              page={t("DASHBOARD_PAGE_CRUMB_PAGE")}
              title={t("DASHBOARD_UNKNOWN_VIEWER")}
            />
            <p className="text-sm text-muted-foreground">{t("DASHBOARD_PROFILE_MISSING")}</p>
          </>
        ) : (
          <ProfileBody
            name={profile.name}
            avatar={profile.avatar}
            badgesEnabled={badgesEnabled}
            stats={profile.stats}
            moments={profile.moments}
            showcase={profile.showcase}
            grid={profile.grid}
            clock={clock}
          />
        )}
      </div>
    </Layout>
  );
}

function ProfileBody({
  name,
  avatar,
  badgesEnabled,
  stats,
  moments,
  showcase,
  grid,
  clock,
}: {
  name: string;
  avatar?: string;
  badgesEnabled: boolean;
  stats: ViewerStats;
  moments: { id: string; name: string; emoji: string; rarity: Rarity }[];
  showcase: ProfileAchievement[];
  grid: ProfileAchievement[];
  clock: EngineClock;
}) {
  const { t } = useTranslation();
  const shown = name.trim().length > 0 ? name : t("DASHBOARD_UNKNOWN_VIEWER");
  const rows: Array<{ label: string; value: string }> = [
    { label: t("DASHBOARD_PROFILE_TOTAL"), value: String(stats.totals.all) },
    { label: t("DASHBOARD_TYPE_CHAT"), value: String(stats.totals.chat) },
    {
      label: t("DASHBOARD_TYPE_CHANNEL_POINTS"),
      value: String(stats.totals["channel-points"]),
    },
    { label: t("DASHBOARD_TYPE_SUBSCRIBERS"), value: String(stats.totals.subscribers) },
    {
      label: t("DASHBOARD_PROFILE_FIRST"),
      value: stats.firstWinAt ? formatAbsolute(stats.firstWinAt, clock.timeZone) : "—",
    },
    {
      label: t("DASHBOARD_PROFILE_LAST"),
      value: stats.lastWinAt ? formatAbsolute(stats.lastWinAt, clock.timeZone) : "—",
    },
    {
      label: t("DASHBOARD_PROFILE_DAYS"),
      value: stats.daysSinceLastWin == null ? "—" : String(stats.daysSinceLastWin),
    },
    { label: t("DASHBOARD_PROFILE_24H"), value: String(stats.wins24h) },
    { label: t("DASHBOARD_PROFILE_7D"), value: String(stats.wins7d) },
    { label: t("DASHBOARD_PROFILE_MONTH"), value: String(stats.winsThisMonth) },
    { label: t("DASHBOARD_PROFILE_STREAK"), value: String(stats.currentStreak) },
    { label: t("DASHBOARD_PROFILE_BEST"), value: String(stats.bestStreak) },
    { label: t("DASHBOARD_PROFILE_GIVEAWAYS"), value: String(stats.distinctGiveaways) },
    { label: t("DASHBOARD_PROFILE_UNDATED"), value: String(stats.undatedWins) },
    {
      label: t("DASHBOARD_PROFILE_POSITION"),
      value: stats.monthPosition == null ? "—" : `${stats.monthPosition}º`,
    },
  ];

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Avatar className="size-14">
          {avatar ? <AvatarImage src={avatar} alt="" /> : null}
          <AvatarFallback>{initials(shown)}</AvatarFallback>
        </Avatar>
        <ShellHeader
          section={t("DASHBOARD_PAGE_CRUMB_SECTION")}
          page={t("DASHBOARD_PAGE_CRUMB_PAGE")}
          title={shown}
        />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("DASHBOARD_PROFILE_LOCAL")}</p>
      <section aria-label={t("DASHBOARD_PROFILE_STATS")} className="mb-4">
        <h2 className="mb-2 font-display text-lg font-bold">{t("DASHBOARD_PROFILE_STATS")}</h2>
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-[var(--sd-radius-lg)] border bg-card px-3 py-2">
              <dt className="text-xs font-semibold text-muted-foreground">{row.label}</dt>
              <dd className="font-display text-lg font-bold tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {badgesEnabled ? (
        <>
          <section aria-label={t("DASHBOARD_PROFILE_MOMENTS")} className="mb-4">
            <h2 className="mb-2 font-display text-lg font-bold">{t("DASHBOARD_PROFILE_MOMENTS")}</h2>
            {moments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("DASHBOARD_FEW_ALL")}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {moments.map((badge) => (
                  <li
                    key={badge.id}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm"
                  >
                    <span aria-hidden="true">{badge.emoji}</span>
                    <span>
                      {badge.name}
                      <span className="sr-only">, {t(RARITY_KEY[badge.rarity])}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label={t("DASHBOARD_PROFILE_SHOWCASE")} className="mb-4" data-showcase>
            <h2 className="mb-2 font-display text-lg font-bold">{t("DASHBOARD_PROFILE_SHOWCASE")}</h2>
            <AchievementGrid items={showcase} clock={clock} locked={false} />
          </section>
          <section aria-label={t("DASHBOARD_PROFILE_GRID")} data-achievement-grid>
            <h2 className="mb-2 font-display text-lg font-bold">{t("DASHBOARD_PROFILE_GRID")}</h2>
            <AchievementGrid items={grid} clock={clock} locked />
          </section>
        </>
      ) : null}
    </>
  );
}

function achievementTitle(
  item: ProfileAchievement,
  clock: EngineClock,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (item.id !== "month_king" || !item.month) {
    if (item.times != null && item.times > 1) {
      return `${item.name} ${t("DASHBOARD_PROFILE_KING_TIMES", { count: item.times })}`;
    }
    return item.name;
  }
  const month = monthName(item.month.month);
  const year = currentYear(clock);
  const base =
    year != null && year !== item.month.year
      ? t("DASHBOARD_MONTH_KING_YEAR", { month, year: item.month.year })
      : t("DASHBOARD_MONTH_KING", { month });
  const shared = item.shared ? `${base} · ${t("DASHBOARD_SHARED")}` : base;
  if (item.times != null && item.times > 1) {
    return `${shared} ${t("DASHBOARD_PROFILE_KING_TIMES", { count: item.times })}`;
  }
  return shared;
}

function AchievementGrid({
  items,
  clock,
  locked,
}: {
  items: ProfileAchievement[];
  clock: EngineClock;
  locked: boolean;
}) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("DASHBOARD_FEW_ALL")}</p>;
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => {
        const title = achievementTitle(item, clock, t);
        const muted = locked && !item.unlocked;
        return (
          <li
            key={item.key}
            data-unlocked={item.unlocked ? "true" : "false"}
            className={cn(
              "flex items-center gap-3 rounded-[var(--sd-radius-lg)] border bg-card px-3 py-2",
              muted && "opacity-50",
            )}
          >
            <span aria-hidden="true">{item.emoji}</span>
            {item.unlocked ? (
              <RarityBadge name={title} rarity={item.rarity} size={32} />
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">
                {t("DASHBOARD_PROFILE_LOCKED")}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-semibold">{title}</span>
              <span className="sr-only">{t(RARITY_KEY[item.rarity])}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
