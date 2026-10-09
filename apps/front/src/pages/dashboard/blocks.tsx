import type { ReactNode } from "react";
import { Link } from "react-router";
import { Crown, Medal, Trophy, type LucideIcon } from "lucide-react";
import { RarityBadge } from "@/components/rarity-badge/rarity-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";
import type { EngineClock, GiveawayType, Rarity } from "@/lib/winner-badges/types";
import { cn } from "@/lib/utils";
import {
  currentMonthName,
  currentYear,
  formatAbsolute,
  formatRelative,
  initials,
  monthName,
  placeLabel,
} from "./format";
import {
  giveawayPath,
  viewerPath,
  type AchievementFeedItem,
  type DashboardBadge,
  type DashboardView,
  type RecentWinner,
  type TopWinner,
} from "./model";
import type { DashboardPeriod, DashboardType } from "./preferences";

const RARITY_KEY: Record<Rarity, string> = {
  common: "BADGES_RARITY_COMMON",
  uncommon: "BADGES_RARITY_UNCOMMON",
  rare: "BADGES_RARITY_RARE",
  epic: "BADGES_RARITY_EPIC",
  legendary: "BADGES_RARITY_LEGENDARY",
};

const TYPE_EMOJI: Record<GiveawayType, string> = {
  chat: "💬",
  "channel-points": "🟣",
  subscribers: "⭐",
};

const TYPE_LABEL: Record<GiveawayType, string> = {
  chat: "DASHBOARD_TYPE_CHAT",
  "channel-points": "DASHBOARD_TYPE_CHANNEL_POINTS",
  subscribers: "DASHBOARD_TYPE_SUBSCRIBERS",
};

function displayName(name: string, fallback: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function winUnit(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function TypeChip({ type }: { type: GiveawayType }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-semibold">
      <span aria-hidden="true">{TYPE_EMOJI[type]}</span>
      {t(TYPE_LABEL[type])}
    </span>
  );
}

function FocusTip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={className} aria-label={label}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function PersonName({
  linked,
  platform,
  userId,
  name,
  label,
}: {
  linked: boolean;
  platform: string;
  userId: string;
  name: string;
  label: string;
}) {
  const className = "truncate font-semibold text-foreground hover:underline";
  if (!linked || userId.length === 0) {
    return <span className="truncate font-semibold">{name}</span>;
  }
  return (
    <Link
      to={viewerPath(platform, userId)}
      className={className}
      aria-label={label}
    >
      {name}
    </Link>
  );
}

function Block({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section
      data-block={id}
      className="flex min-w-0 flex-col rounded-[var(--sd-radius-xl)] border bg-card"
    >
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 className="font-display text-lg font-bold">{title}</h2>
      </header>
      <div className="flex-1 px-4 py-3">{children}</div>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        {t("DASHBOARD_BLOCK_FOOTER")}
      </p>
    </section>
  );
}

function Few({
  period,
  month,
  onSeeAll,
}: {
  period: DashboardPeriod;
  month: string;
  onSeeAll: () => void;
}) {
  const { t } = useTranslation();
  if (period === "all") {
    return <p className="py-6 text-sm text-muted-foreground">{t("DASHBOARD_FEW_ALL")}</p>;
  }
  return (
    <div className="flex flex-col items-start gap-2 py-6">
      <p className="text-sm text-muted-foreground">
        {t("DASHBOARD_FEW_MONTH", { month })}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onSeeAll}>
        {t("DASHBOARD_SEE_ALL")}
      </Button>
    </div>
  );
}

function When({ iso, clock }: { iso: string; clock: EngineClock }) {
  const relative = formatRelative(iso, clock.now);
  const absolute = formatAbsolute(iso, clock.timeZone);
  const label = absolute.length > 0 ? `${relative}. ${absolute}` : relative;
  return (
    <FocusTip
      label={label}
      className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
    >
      <time dateTime={iso}>{relative}</time>
    </FocusTip>
  );
}

function BadgeIcons({ badges }: { badges: DashboardBadge[] }) {
  const { t } = useTranslation();
  if (badges.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {badges.map((badge) => {
        const rarity = t(RARITY_KEY[badge.rarity]);
        const label = `${badge.name}, ${rarity}`;
        return (
          <FocusTip key={badge.id} label={label} className="text-base leading-none">
            <span aria-hidden="true">{badge.emoji}</span>
          </FocusTip>
        );
      })}
    </span>
  );
}

function GiveawayTitle({ row }: { row: RecentWinner }) {
  const { t } = useTranslation();
  const title =
    row.giveawayTitle.trim().length > 0
      ? row.giveawayTitle
      : t("DASHBOARD_GIVEAWAY_FALLBACK");
  if (row.deleted) {
    const label = `${title} ${t("DASHBOARD_DELETED")}. ${t("DASHBOARD_DELETED_TOOLTIP")}`;
    return (
      <FocusTip label={label} className="min-w-0 truncate text-left text-sm text-muted-foreground">
        <span className="truncate">{title}</span>
        <span className="text-muted-foreground"> {t("DASHBOARD_DELETED")}</span>
      </FocusTip>
    );
  }
  return (
    <Link
      to={giveawayPath(row.giveawayType, row.giveawayId)}
      className="min-w-0 truncate text-sm text-foreground hover:underline"
    >
      {title}
    </Link>
  );
}

function WinnerRow({ row, clock }: { row: RecentWinner; clock: EngineClock }) {
  const { t } = useTranslation();
  const name = displayName(row.name, t("DASHBOARD_UNKNOWN_VIEWER"));
  return (
    <li className="flex items-center gap-3 border-b border-border/70 py-2.5 last:border-b-0">
      <Avatar>
        {row.avatar ? <AvatarImage src={row.avatar} alt="" /> : null}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <PersonName
            linked={row.linked}
            platform={row.platform}
            userId={row.userId}
            name={name}
            label={name}
          />
          <TypeChip type={row.giveawayType} />
          <BadgeIcons badges={row.badges} />
        </div>
        <GiveawayTitle row={row} />
      </div>
      <When iso={row.wonAt} clock={clock} />
    </li>
  );
}

function achievementLabel(
  item: AchievementFeedItem,
  clock: EngineClock,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (item.achievementId !== "month_king" || !item.month) return item.catalogName;
  const month = monthName(item.month.month);
  const year = currentYear(clock);
  const base =
    year != null && year !== item.month.year
      ? t("DASHBOARD_MONTH_KING_YEAR", { month, year: item.month.year })
      : t("DASHBOARD_MONTH_KING", { month });
  return item.shared ? `${base} · ${t("DASHBOARD_SHARED")}` : base;
}

function AchievementRow({
  item,
  clock,
}: {
  item: AchievementFeedItem;
  clock: EngineClock;
}) {
  const { t } = useTranslation();
  const name = displayName(item.name, t("DASHBOARD_UNKNOWN_VIEWER"));
  const title = achievementLabel(item, clock, t);
  const rarity = t(RARITY_KEY[item.rarity]);
  return (
    <li className="flex items-center gap-3 border-b border-border/70 py-2.5 last:border-b-0">
      <span aria-hidden="true" className="text-base">
        {item.emoji}
      </span>
      <RarityBadge name={title} rarity={item.rarity} size={28} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {title}
          <span className="sr-only">, {rarity}</span>
        </p>
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <PersonName
            linked={item.linked}
            platform={item.platform}
            userId={item.userId}
            name={name}
            label={name}
          />
          {item.unlockedAt ? <When iso={item.unlockedAt} clock={clock} /> : null}
        </div>
      </div>
    </li>
  );
}

function rankLabel(
  name: string,
  position: number,
  wins: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return t("DASHBOARD_RANK_ARIA", {
    name,
    place: placeLabel(position),
    count: wins,
    unit: winUnit(wins, t("DASHBOARD_WIN_ONE"), t("DASHBOARD_WIN_MANY")),
  });
}

function breakdown(row: TopWinner, t: (key: string, options?: Record<string, unknown>) => string): string {
  return t("DASHBOARD_WINS_BREAKDOWN", {
    chat: row.byType.chat,
    points: row.byType["channel-points"],
    subs: row.byType.subscribers,
  });
}

function PodiumCard({ row, featured }: { row: TopWinner; featured: boolean }) {
  const { t } = useTranslation();
  const name = displayName(row.name, t("DASHBOARD_UNKNOWN_VIEWER"));
  const aria = rankLabel(name, row.position, row.wins, t);
  return (
    <article
      data-podium={row.position}
      className={cn(
        "flex min-w-0 flex-col items-center rounded-[var(--sd-radius-lg)] border bg-background px-2 py-3 text-center",
        featured && "border-primary/50 bg-primary/5 pb-5",
      )}
    >
      <p className="font-mono text-xs text-muted-foreground" aria-hidden="true">
        {placeLabel(row.position)}
      </p>
      <Avatar className={cn("mt-2", featured && "size-12")}>
        {row.avatar ? <AvatarImage src={row.avatar} alt="" /> : null}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="mt-2 max-w-full">
        <PersonName
          linked
          platform={row.platform}
          userId={row.userId}
          name={name}
          label={aria}
        />
      </div>
      <FocusTip
        label={breakdown(row, t)}
        className="mt-1 font-display text-2xl font-extrabold tabular-nums"
      >
        {row.wins}
      </FocusTip>
      <p className="text-xs font-semibold text-muted-foreground" data-column="wins">
        {t("DASHBOARD_COLUMN_WINS")}
      </p>
    </article>
  );
}

function Podium({ rows }: { rows: TopWinner[] }) {
  const first = rows.find((row) => row.position === 1);
  const second = rows.find((row) => row.position === 2);
  const third = rows.find((row) => row.position === 3);
  if (first && second && third) {
    return (
      <div className="grid grid-cols-3 items-end gap-2">
        <PodiumCard row={second} featured={false} />
        <PodiumCard row={first} featured />
        <PodiumCard row={third} featured={false} />
      </div>
    );
  }
  const visible = rows.filter((row) => row.position <= 3);
  return (
    <div className="flex items-end justify-center gap-2">
      {visible.map((row) => (
        <div key={row.userKey} className="w-full max-w-40">
          <PodiumCard row={row} featured={row.position === 1} />
        </div>
      ))}
    </div>
  );
}

function TopList({ rows }: { rows: TopWinner[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <table className="mt-3 w-full text-sm" data-top-list>
      <thead>
        <tr>
          <th scope="col" className="pb-1 text-left text-xs font-semibold text-muted-foreground">
            <span className="sr-only">{t("DASHBOARD_COLUMN_VIEWER")}</span>
          </th>
          <th
            scope="col"
            className="pb-1 text-right text-xs font-semibold text-muted-foreground"
          >
            {t("DASHBOARD_COLUMN_WINS")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const name = displayName(row.name, t("DASHBOARD_UNKNOWN_VIEWER"));
          const aria = rankLabel(name, row.position, row.wins, t);
          return (
            <tr key={row.userKey} data-rank={row.position} className="border-t">
              <td className="py-2 pr-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-6 font-mono text-xs text-muted-foreground" aria-hidden="true">
                    {placeLabel(row.position)}
                  </span>
                  <Avatar className="size-7">
                    {row.avatar ? <AvatarImage src={row.avatar} alt="" /> : null}
                    <AvatarFallback>{initials(name)}</AvatarFallback>
                  </Avatar>
                  <PersonName
                    linked
                    platform={row.platform}
                    userId={row.userId}
                    name={name}
                    label={aria}
                  />
                </div>
              </td>
              <td className="py-2 text-right font-display text-base font-bold tabular-nums">
                <FocusTip label={breakdown(row, t)} className="tabular-nums">
                  {row.wins}
                </FocusTip>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function DashboardBlocks({
  view,
  clock,
  period,
  onSeeAll,
}: {
  view: DashboardView;
  clock: EngineClock;
  period: DashboardPeriod;
  onSeeAll: () => void;
}) {
  const { t } = useTranslation();
  const month = currentMonthName(clock);
  const rest = view.topWinners.filter((row) => row.position >= 4);
  const few = <Few period={period} month={month} onSeeAll={onSeeAll} />;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <Block id="recent-winners" title={t("DASHBOARD_BLOCK_RECENT_WINNERS")} icon={Trophy}>
          {view.recentWinners.length === 0 ? (
            few
          ) : (
            <ol>
              {view.recentWinners.map((row) => (
                <WinnerRow
                  key={`${row.giveawayType}:${row.giveawayId}:${row.userId}:${row.wonAt}`}
                  row={row}
                  clock={clock}
                />
              ))}
            </ol>
          )}
        </Block>
        {view.showAchievements ? (
          <Block
            id="recent-achievements"
            title={t("DASHBOARD_BLOCK_RECENT_ACHIEVEMENTS")}
            icon={Crown}
          >
            {view.recentAchievements.length === 0 ? (
              few
            ) : (
              <ol>
                {view.recentAchievements.map((item) => (
                  <AchievementRow key={item.key} item={item} clock={clock} />
                ))}
              </ol>
            )}
          </Block>
        ) : null}
      </div>
      <Block id="top-winners" title={t("DASHBOARD_BLOCK_TOP_WINNERS")} icon={Medal}>
        {view.topWinners.length === 0 ? (
          few
        ) : (
          <>
            <Podium rows={view.topWinners} />
            <TopList rows={rest} />
          </>
        )}
      </Block>
    </div>
  );
}

export function SummaryCards({ view }: { view: DashboardView }) {
  const { t } = useTranslation();
  const cards: Array<{ id: string; label: string; value: number }> = [
    { id: "giveaways", label: t("DASHBOARD_SUMMARY_GIVEAWAYS"), value: view.summary.giveaways },
    { id: "wins", label: t("DASHBOARD_SUMMARY_WINS"), value: view.summary.wins },
  ];
  if (view.summary.achievements != null) {
    cards.push({
      id: "achievements",
      label: t("DASHBOARD_SUMMARY_ACHIEVEMENTS"),
      value: view.summary.achievements,
    });
  }
  return (
    <section aria-label={t("DASHBOARD_SUMMARY_LABEL")} className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.id}
          data-summary={card.id}
          className="rounded-[var(--sd-radius-xl)] border bg-card px-4 py-3"
        >
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">{card.label}</p>
          <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{card.value}</p>
        </article>
      ))}
    </section>
  );
}

export function EmptyDashboard() {
  const { t } = useTranslation();
  const links: Array<{ href: string; label: string }> = [
    { href: "/dashboard/chat-giveaway/create", label: t("DASHBOARD_EMPTY_CHAT") },
    { href: "/dashboard/channel-points-giveaway/create", label: t("DASHBOARD_EMPTY_POINTS") },
    { href: "/dashboard/follower-giveaway/create", label: t("DASHBOARD_EMPTY_SUBSCRIBERS") },
  ];
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--sd-radius-xl)] border border-dashed px-6 py-10 text-center">
      <img
        src="/brand/empty-state-ilustracao.svg"
        alt=""
        className="h-auto w-40"
      />
      <div>
        <h2 className="font-display text-xl font-extrabold">{t("DASHBOARD_EMPTY_TITLE")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("DASHBOARD_EMPTY_DESCRIPTION")}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {links.map((link) => (
          <Button key={link.href} asChild variant="outline">
            <Link to={link.href}>{link.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

export function FilterBar({
  period,
  type,
  onPeriod,
  onType,
}: {
  period: DashboardPeriod;
  type: DashboardType;
  onPeriod: (period: DashboardPeriod) => void;
  onType: (type: DashboardType) => void;
}) {
  const { t } = useTranslation();
  const periods: Array<{ value: DashboardPeriod; label: string }> = [
    { value: "month", label: t("DASHBOARD_PERIOD_MONTH") },
    { value: "all", label: t("DASHBOARD_PERIOD_ALL") },
  ];
  const types: Array<{ value: DashboardType; label: string }> = [
    { value: "all", label: t("DASHBOARD_TYPE_ALL") },
    { value: "chat", label: t("DASHBOARD_TYPE_CHAT") },
    { value: "channel-points", label: t("DASHBOARD_TYPE_CHANNEL_POINTS") },
    { value: "subscribers", label: t("DASHBOARD_TYPE_SUBSCRIBERS") },
  ];
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div role="group" aria-label={t("DASHBOARD_PERIOD_LABEL")} className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs font-semibold text-muted-foreground">
          {t("DASHBOARD_PERIOD_LABEL")}
        </span>
        {periods.map((option) => (
          <FilterButton
            key={option.value}
            pressed={period === option.value}
            onClick={() => onPeriod(option.value)}
          >
            {option.label}
          </FilterButton>
        ))}
      </div>
      <div role="group" aria-label={t("DASHBOARD_TYPE_LABEL")} className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs font-semibold text-muted-foreground">
          {t("DASHBOARD_TYPE_LABEL")}
        </span>
        {types.map((option) => (
          <FilterButton
            key={option.value}
            pressed={type === option.value}
            onClick={() => onType(option.value)}
          >
            {option.label}
          </FilterButton>
        ))}
      </div>
    </div>
  );
}

function FilterButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-8 rounded-full border px-3 text-sm font-semibold",
        pressed
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function Notices({
  showLocal,
  showChat,
  onDismissLocal,
  onDismissChat,
}: {
  showLocal: boolean;
  showChat: boolean;
  onDismissLocal: () => void;
  onDismissChat: () => void;
}) {
  const { t } = useTranslation();
  if (!showLocal && !showChat) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      {showLocal ? (
        <Notice text={t("DASHBOARD_NOTICE_LOCAL")} onDismiss={onDismissLocal} />
      ) : null}
      {showChat ? (
        <Notice text={t("DASHBOARD_NOTICE_CHAT")} onDismiss={onDismissChat} />
      ) : null}
    </div>
  );
}

function Notice({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-[var(--sd-radius-lg)] border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
    >
      <p>{text}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-xs font-semibold text-foreground underline-offset-2 hover:underline"
      >
        {t("DASHBOARD_NOTICE_DISMISS")}
      </button>
    </div>
  );
}
