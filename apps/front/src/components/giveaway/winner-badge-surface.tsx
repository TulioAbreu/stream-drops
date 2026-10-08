import { useEffect, useMemo, type ReactNode } from "react";
import { RarityBadge } from "@/components/rarity-badge/rarity-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";
import { getCatalogItem } from "@/lib/winner-badges/catalog";
import {
  startWinnerIndex,
  useCardBadges,
  useConfirmedBadges,
  type DisplaySelection,
} from "@/lib/winner-badges/readiness";
import type { BadgeAward, EngineClock, Rarity, WinEvent } from "@/lib/winner-badges/types";
import { useSettingsStore } from "@/storage/settings";
import { browserClock } from "./winner-badge-win";

const RARITY_KEY: Record<Rarity, string> = {
  common: "BADGES_RARITY_COMMON",
  uncommon: "BADGES_RARITY_UNCOMMON",
  rare: "BADGES_RARITY_RARE",
  epic: "BADGES_RARITY_EPIC",
  legendary: "BADGES_RARITY_LEGENDARY",
};

const IDLE_WIN: WinEvent = {
  userKey: "twitch:unknown",
  platform: "twitch",
  userId: "unknown",
  giveawayType: "chat",
  giveawayId: "none",
  index: 0,
  name: "",
};

export type WinnerBadgeSurfaceName = "card" | "reveal" | "log";

type WinnerBadgeSurfaceProps = {
  surface: WinnerBadgeSurfaceName;
  win: WinEvent | null;
  /** Card do pendente e revelação ainda não confirmada. */
  preview?: boolean;
  clock?: EngineClock;
  align?: "start" | "center";
};

function awardCopy(award: BadgeAward): {
  name: string;
  short: string;
  emoji: string;
} {
  const item = getCatalogItem(award.id);
  const name = item?.name ?? award.id;
  const emoji = item?.emoji ?? "";
  const template = item?.shortName ?? name;
  const short =
    award.count == null
      ? template
      : template.replaceAll("{count}", String(award.count));
  return { name, short, emoji };
}

function useSurfaceClock(
  win: WinEvent | null,
  injected: EngineClock | undefined,
): EngineClock {
  const key = win
    ? `${win.giveawayType}:${win.giveawayId}:${win.index}:${win.userId}:${win.preview ? "p" : "c"}`
    : "none";
  const frozen = useMemo(() => injected ?? browserClock(), [injected, key]);
  return injected ?? frozen;
}

export function WinnerBadgeSurface({
  surface,
  win,
  preview = false,
  clock: injectedClock,
  align = "center",
}: WinnerBadgeSurfaceProps) {
  const { t } = useTranslation();
  const enabled = useSettingsStore((state) => state.badges.enabled);
  const clock = useSurfaceClock(win, injectedClock);
  const active = win ?? IDLE_WIN;
  const cardState = useCardBadges(active, clock);
  const confirmedState = useConfirmedBadges(active, clock);

  useEffect(() => {
    if (!enabled) return;
    startWinnerIndex();
  }, [enabled]);

  if (!enabled || !win) return null;

  const state = preview ? cardState : confirmedState;
  const selection = state.selection;
  const waiting = state.status === "loading" && surface !== "log";

  if (waiting) {
    return (
      <div
        data-badge-slot="loading"
        data-winner-badges={surface}
        aria-hidden
        className="mt-2 h-7"
      />
    );
  }

  if (state.status !== "ready") return null;
  if (surface === "log") {
    if (selection.log.length === 0) return null;
    return (
      <LogBadges
        selection={selection}
        label={t("BADGES_LIST_LABEL")}
        rarityLabel={(rarity) => t(RARITY_KEY[rarity])}
      />
    );
  }

  if (selection.card.length === 0 && !selection.highlight) return null;

  return (
    <CardBadges
      surface={surface}
      preview={preview}
      selection={selection}
      previewLabel={t("BADGES_PREVIEW")}
      unlockedLabel={t("BADGES_UNLOCKED")}
      ifConfirmedLabel={t("BADGES_IF_CONFIRMED")}
      listLabel={
        preview ? t("BADGES_LIST_PREVIEW_LABEL") : t("BADGES_LIST_LABEL")
      }
      rarityLabel={(rarity) => t(RARITY_KEY[rarity])}
      align={align}
    />
  );
}

function BadgeTooltip({
  awards,
  rarityLabel,
  children,
}: {
  awards: BadgeAward[];
  rarityLabel: (rarity: Rarity) => string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="z-[90] max-w-xs">
        <ul className="space-y-1">
          {awards.map((award) => {
            const copy = awardCopy(award);
            return (
              <li key={award.id} data-badge-tooltip-item={award.id}>
                <span aria-hidden>{copy.emoji} </span>
                {copy.name}, {rarityLabel(award.rarity)}
              </li>
            );
          })}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function CardBadges({
  surface,
  preview,
  selection,
  previewLabel,
  unlockedLabel,
  ifConfirmedLabel,
  listLabel,
  rarityLabel,
  align,
}: {
  surface: WinnerBadgeSurfaceName;
  preview: boolean;
  selection: DisplaySelection;
  previewLabel: string;
  unlockedLabel: string;
  ifConfirmedLabel: string;
  listLabel: string;
  rarityLabel: (rarity: Rarity) => string;
  align: "start" | "center";
}) {
  const highlight = selection.highlight;
  const highlightCopy = highlight ? awardCopy(highlight) : null;

  return (
    <div
      className={
        align === "center"
          ? "mt-2 flex flex-col items-center gap-1"
          : "mt-2 flex flex-col items-start gap-1"
      }
    >
      {highlight && highlightCopy ? (
        <p
          data-badge-highlight
          className="text-center text-xs font-semibold text-foreground"
        >
          {unlockedLabel} {highlightCopy.name}
          {preview ? (
            <span data-badge-if-confirmed className="text-muted-foreground">
              {" "}
              · {ifConfirmedLabel}
            </span>
          ) : null}
        </p>
      ) : null}
      <BadgeTooltip awards={selection.tooltip} rarityLabel={rarityLabel}>
        <div
          role="group"
          tabIndex={0}
          data-winner-badges={surface}
          data-preview={preview ? "true" : "false"}
          aria-label={listLabel}
          className={`flex h-7 max-w-full items-center gap-1.5 outline-none focus-visible:shadow-[var(--sd-focus)] ${align === "center" ? "justify-center" : "justify-start"}`}
        >
          {preview ? (
            <span
              data-badge-preview
              className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {previewLabel}
            </span>
          ) : null}
          {selection.card.map((award, index) => (
            <BadgeChip
              key={award.id}
              award={award}
              index={index}
              rarityLabel={rarityLabel(award.rarity)}
            />
          ))}
          {selection.cardOverflow > 0 ? (
            <span
              data-badge-overflow
              className="sd-badge-chip inline-flex h-7 items-center rounded-full border border-border px-2 text-xs font-semibold text-muted-foreground"
            >
              +{selection.cardOverflow}
            </span>
          ) : null}
        </div>
      </BadgeTooltip>
    </div>
  );
}

function BadgeChip({
  award,
  index,
  rarityLabel,
}: {
  award: BadgeAward;
  index: number;
  rarityLabel: string;
}) {
  const copy = awardCopy(award);
  return (
    <span
      data-winner-badge={award.id}
      data-rarity={award.rarity}
      aria-label={`${copy.name}, ${rarityLabel}`}
      className="sd-badge-chip inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-semibold"
      style={{
        animationDelay: `${index * 40}ms`,
        color: `var(--rarity-${award.rarity}-foreground)`,
        borderColor: `var(--rarity-${award.rarity})`,
        background: `var(--rarity-${award.rarity}-soft)`,
      }}
    >
      <span aria-hidden className="inline-flex">
        <RarityBadge name={copy.name} rarity={award.rarity} size={16} />
      </span>
      <span aria-hidden>{copy.emoji}</span>
      <span>{copy.short}</span>
    </span>
  );
}

function LogBadges({
  selection,
  label,
  rarityLabel,
}: {
  selection: DisplaySelection;
  label: string;
  rarityLabel: (rarity: Rarity) => string;
}) {
  return (
    <BadgeTooltip awards={selection.tooltip} rarityLabel={rarityLabel}>
      <button
        type="button"
        data-winner-badges="log"
        aria-label={label}
        className="inline-flex h-4 shrink-0 items-center gap-1 rounded-sm outline-none focus-visible:shadow-[var(--sd-focus)]"
      >
        {selection.log.map((award) => {
          const copy = awardCopy(award);
          return (
            <span
              key={award.id}
              data-winner-log-badge={award.id}
              className="inline-flex"
            >
              <RarityBadge name={copy.name} rarity={award.rarity} size={16} />
            </span>
          );
        })}
      </button>
    </BadgeTooltip>
  );
}
