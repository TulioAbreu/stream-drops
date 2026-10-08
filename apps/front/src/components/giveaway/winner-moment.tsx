import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";
import { CheckIcon, HardDrive, RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { WinnerChest, WinnerGem, WinnerSpark, gemColor, gemMid } from "./winner-chest";
import {
  applyNameFit,
  dropRarity,
  playWinnerReveal,
  type NameFit,
} from "./winner-reveal";
import type { GiveawayChatMessage, PendingWinnerInfo } from "./types";

type Phase = "entering" | "expanded" | "collapsing" | "exiting";

const TRANSITION_MS = 320;

export interface WinnerMomentProps {
  pendingWinner: PendingWinnerInfo;
  messages: GiveawayChatMessage[];
  rank?: number;
  giveawayTitle: string;
  onConfirm: () => Promise<void> | void;
  onDismiss: () => void;
  onCancel: () => void;
  onRedraw: () => void;
  isRedrawing: boolean;
}

function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function accentForTier(tier: PendingWinnerInfo["tier"]): string {
  if (tier === 3000) return "var(--rarity-legendary)";
  if (tier === 2000) return "var(--rarity-epic)";
  if (tier === 1000) return "var(--rarity-rare)";
  return "var(--primary)";
}

function labelColorForTier(tier: PendingWinnerInfo["tier"]): string {
  if (tier === 3000) return "var(--rarity-legendary-foreground)";
  if (tier === 2000) return "var(--rarity-epic-foreground)";
  if (tier === 1000) return "var(--rarity-rare-foreground)";
  return "var(--foreground)";
}

function withEllipsisName(text: string, name: string): ReactNode {
  if (!name) return text;
  const index = text.indexOf(name);
  if (index < 0) return text;
  return (
    <span>
      {text.slice(0, index)}
      <span
        className="inline-block max-w-[240px] truncate align-bottom"
        title={name}
      >
        {name}
      </span>
      {text.slice(index + name.length)}
    </span>
  );
}

export function WinnerMoment({
  pendingWinner,
  messages,
  rank = 1,
  giveawayTitle,
  onConfirm,
  onDismiss,
  onCancel,
  onRedraw,
  isRedrawing,
}: WinnerMomentProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("entering");
  const [confirmationStartTime, setConfirmationStartTime] = useState<Date | null>(
    null,
  );
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(
    null,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [nameFit, setNameFit] = useState<NameFit>({
    size: 112,
    trunc: false,
    max: 0,
    peak: 1.18,
  });
  const finishActionRef = useRef<"confirm" | "cancel" | null>(null);
  const onCancelRef = useRef(onCancel);
  const onDismissRef = useRef(onDismiss);
  onCancelRef.current = onCancel;
  onDismissRef.current = onDismiss;

  const isExpanded = phase === "entering" || phase === "expanded";
  const canAct = isExpanded && !isConfirming;

  const winnerMessages = useMemo(() => {
    if (!timerStartTimestamp) return [];
    return messages.filter(
      (message) =>
        message.userId === pendingWinner.id &&
        new Date(message.timestamp).getTime() > timerStartTimestamp,
    );
  }, [messages, pendingWinner.id, timerStartTimestamp]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setPhase("entering");
    finishActionRef.current = null;
    setIsConfirming(false);
    const now = new Date();
    setConfirmationStartTime(now);
    setTimerStartTimestamp(now.getTime());
    setElapsedSeconds(0);
    setIsPaused(false);

    const frame = requestAnimationFrame(() => setPhase("expanded"));
    dialogRef.current?.focus();

    if (!prefersReducedMotion()) {
      // O confete visível sai da boca do baú (DOM, no máximo 56 peças).
      // A chamada mantém o contrato de celebração sem o burst antigo.
      confetti({ particleCount: 0, disableForReducedMotion: true });
    }

    return () => cancelAnimationFrame(frame);
  }, [pendingWinner.id]);

  const rarity = dropRarity(pendingWinner.tier);
  const showHalo = rarity !== "common";
  const showSparkles = rarity === "epic" || rarity === "legendary";
  const showRays = rarity === "legendary" && !reducedMotion;
  const showVeil = rarity === "legendary" && !reducedMotion;

  useLayoutEffect(() => {
    const stage = dialogRef.current;
    if (!stage) return;
    const fit = applyNameFit(stage);
    setNameFit((current) =>
      current.size === fit.size &&
      current.trunc === fit.trunc &&
      current.max === fit.max
        ? current
        : fit,
    );
    return playWinnerReveal(stage, {
      rarity,
      reduced: reducedMotion,
      peak: fit.peak,
    });
  }, [pendingWinner.id, pendingWinner.displayName, rarity, reducedMotion]);

  useEffect(() => {
    if (!timerStartTimestamp || isPaused || !isExpanded) return;
    if (winnerMessages.length > 0) setIsPaused(true);
  }, [winnerMessages, timerStartTimestamp, isPaused, isExpanded]);

  useEffect(() => {
    if (!confirmationStartTime || isPaused || !isExpanded) return;
    const interval = setInterval(() => {
      const diff = Math.floor(
        (Date.now() - confirmationStartTime.getTime()) / 1000,
      );
      setElapsedSeconds(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [confirmationStartTime, isPaused, isExpanded]);

  useEffect(() => {
    if (phase !== "collapsing" && phase !== "exiting") return;
    const delay = prefersReducedMotion() ? 0 : TRANSITION_MS;
    const timeout = window.setTimeout(() => {
      const action = finishActionRef.current;
      finishActionRef.current = null;
      if (action === "cancel") {
        onCancelRef.current();
        return;
      }
      if (action === "confirm") onDismissRef.current();
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [phase]);

  const handleConfirm = async () => {
    if (!canAct) return;
    setIsConfirming(true);
    try {
      await onConfirm();
      finishActionRef.current = "confirm";
      setPhase("collapsing");
    } catch {
      setIsConfirming(false);
      finishActionRef.current = null;
    }
  };

  const handleCancel = () => {
    if (!canAct) return;
    finishActionRef.current = "cancel";
    setPhase("exiting");
  };

  // Esc não fecha o palco. Cancelar descarta o pendente e Confirmar grava;
  // não há um fechar que só esconda o overlay e mantenha o vencedor no log.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>("button:not([disabled])"),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const eyebrow = pendingWinner.tier
    ? t("WINNER_MOMENT_TIER", { tier: pendingWinner.tier / 1000 })
    : pendingWinner.subscriber
      ? t("WINNER_MOMENT_SUB")
      : t("WINNER_MOMENT_DROP");

  const subtitle = [
    t("WINNER_MOMENT_RANK", { rank }),
    pendingWinner.subscriptionMonths && pendingWinner.subscriptionMonths > 0
      ? t("WINNER_MOMENT_SUB_MONTHS", {
          count: pendingWinner.subscriptionMonths,
        })
      : null,
    giveawayTitle,
  ]
    .filter(Boolean)
    .join(" · ");

  const elapsed = formatElapsedTime(elapsedSeconds);
  const waiting =
    winnerMessages.length > 0
      ? t("WINNER_MOMENT_REPLIED", { name: pendingWinner.displayName, time: elapsed })
      : t("WINNER_MOMENT_WAITING", { name: pendingWinner.displayName, time: elapsed });

  const nameId = "winner-moment-name";

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={nameId}
      tabIndex={-1}
      data-winner-moment
      data-motion={reducedMotion ? "reduced" : "full"}
      onKeyDown={onKeyDown}
      className="sd-winner-stage fixed inset-0 z-[80] flex flex-col items-center justify-end overflow-hidden px-6 pt-16 pb-10 outline-none focus-visible:shadow-[var(--sd-focus)]"
      style={{
        ["--sd-winner-accent" as string]: accentForTier(pendingWinner.tier),
        ["--sd-drop-md" as string]: gemMid(rarity),
      }}
    >
      <div aria-hidden data-reveal="bg" className="sd-winner-bg" />
      <div aria-hidden data-winner-beam className="sd-winner-beam" />
      <div aria-hidden className="sd-winner-beam sd-winner-beam--soft" />
      {showVeil ? <div aria-hidden data-reveal="veil" className="sd-winner-veil" /> : null}
      {showHalo || showRays ? (
        <div aria-hidden data-reveal="back" className="sd-winner-mid sd-winner-mid--back">
          {showHalo ? <div data-reveal="halo" className="sd-winner-halo" /> : null}
          {showRays ? <div data-reveal="rays" className="sd-winner-rays" /> : null}
        </div>
      ) : null}
      <div aria-hidden data-reveal="gems" className="sd-winner-mid sd-winner-mid--gem">
        <div data-reveal="gem" className="sd-winner-gem">
          <div data-reveal="gem-move" className="size-full">
            <div data-reveal="gem-bob" className="size-full">
              <WinnerGem rarity={rarity} />
            </div>
          </div>
        </div>
        {showSparkles ? (
          <>
            <div data-reveal="spark" className="sd-winner-spark">
              <WinnerSpark color={gemColor(rarity)} />
            </div>
            <div data-reveal="spark" className="sd-winner-spark">
              <WinnerSpark color={gemColor(rarity)} />
            </div>
          </>
        ) : null}
      </div>
      <div aria-hidden data-reveal="fx" className="sd-winner-fx" />

      <div
        data-reveal="top"
        className="sd-winner-top absolute inset-x-0 top-12 text-center sm:top-16"
      >
        <p
          data-reveal="eyebrow"
          className="text-[13px] font-bold tracking-[0.28em] uppercase sm:text-[15px]"
          style={{ color: labelColorForTier(pendingWinner.tier) }}
        >
          {eyebrow}
        </p>
        <p
          id={nameId}
          data-reveal="name"
          className={`sd-winner-name mt-4 font-display leading-none font-extrabold text-foreground${nameFit.trunc ? " sd-winner-name--trunc" : ""}`}
          style={{
            fontSize: nameFit.size,
            maxWidth: nameFit.trunc ? nameFit.max : undefined,
          }}
          title={nameFit.trunc ? pendingWinner.displayName : undefined}
        >
          <span className="sd-winner-name-text inline-block">
            {pendingWinner.displayName}
          </span>
        </p>
        <p
          data-reveal="subtitle"
          className="mx-auto mt-4 max-w-[720px] text-base text-muted-foreground sm:text-[22px]"
        >
          {subtitle}
        </p>
      </div>

      <div data-winner-bottom className="relative z-10 flex flex-col items-center gap-5">
        <div className="flex items-end justify-center gap-4">
          <div data-reveal="avatar" className="shrink-0">
            <Avatar
              className="size-24 border-2 shadow-[var(--sd-shadow-2)] sm:size-28"
              style={{ borderColor: "var(--sd-winner-accent)" }}
            >
              {pendingWinner.avatar ? (
                <AvatarImage src={pendingWinner.avatar} alt="" />
              ) : null}
              <AvatarFallback className="font-display text-3xl font-extrabold">
                {pendingWinner.displayName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div data-reveal="slot" data-winner-slot className="sd-winner-slot">
            <div data-reveal="shake" className="sd-winner-shake">
              <WinnerChest rarity={rarity} />
            </div>
          </div>
        </div>

        <p className="inline-flex max-w-[560px] items-center justify-center rounded-full border border-dashed border-[var(--sd-border-strong)] bg-card/80 px-4 py-2 text-center text-sm text-foreground">
          {withEllipsisName(waiting, pendingWinner.displayName)}
          {isPaused ? (
            <span className="ml-2 font-semibold text-[var(--sd-warning)]">
              {t("WINNER_MOMENT_PAUSED")}
            </span>
          ) : null}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="lg"
            onClick={handleCancel}
            disabled={isRedrawing || isConfirming}
          >
            {t("WINNER_MOMENT_CANCEL")}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onRedraw}
            disabled={isRedrawing || isConfirming}
          >
            <RotateCcw
              className={isRedrawing ? "animate-spin motion-reduce:animate-none" : undefined}
            />
            {isRedrawing ? t("WINNER_MOMENT_REDRAWING") : t("WINNER_MOMENT_REDRAW")}
          </Button>
          <Button
            size="lg"
            onClick={handleConfirm}
            disabled={isRedrawing || isConfirming}
            loading={isConfirming && isExpanded}
          >
            <CheckIcon />
            {t("WINNER_MOMENT_CONFIRM")}
          </Button>
        </div>

        <p className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--sd-local)_22%,transparent)] bg-[var(--sd-local-soft)] px-3 py-1 text-xs font-semibold text-[var(--sd-local)]">
          <HardDrive className="size-3.5" />
          {t("WINNER_MOMENT_LOCAL")}
        </p>
      </div>
    </div>,
    document.body,
  );
}
