import { useEffect, useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckIcon, XIcon, Clock, Star } from "lucide-react";
import confetti from "canvas-confetti";
import { ChatContainer } from "./chat-container";
import { SubscriptionTierBadge } from "./subscription-tier-badge";
import { cn } from "@/lib/utils";
import type { GiveawayChatMessage, PendingWinnerInfo } from "./types";

type Phase = "entering" | "expanded" | "collapsing" | "exiting";

const TRANSITION_MS = 320;

interface WinnerConfirmationInlineProps {
  pendingWinner: PendingWinnerInfo;
  messages: GiveawayChatMessage[];
  rank?: number;
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

export function WinnerConfirmationInline({
  pendingWinner,
  messages,
  rank = 1,
  onConfirm,
  onDismiss,
  onCancel,
  onRedraw,
  isRedrawing,
}: WinnerConfirmationInlineProps) {
  const [phase, setPhase] = useState<Phase>("entering");
  const [confirmationStartTime, setConfirmationStartTime] = useState<Date | null>(
    null
  );
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(
    null
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const finishActionRef = useRef<"confirm" | "cancel" | null>(null);
  const onCancelRef = useRef(onCancel);
  const onDismissRef = useRef(onDismiss);
  onCancelRef.current = onCancel;
  onDismissRef.current = onDismiss;

  const isExpanded = phase === "entering" || phase === "expanded";
  const detailsOpen = phase === "expanded";

  const winnerMessages = useMemo(() => {
    if (!timerStartTimestamp) return [];

    return messages.filter(
      (msg) =>
        msg.userId === pendingWinner.id &&
        new Date(msg.timestamp).getTime() > timerStartTimestamp
    );
  }, [messages, pendingWinner.id, timerStartTimestamp]);

  useEffect(() => {
    setPhase("entering");
    finishActionRef.current = null;
    setIsConfirming(false);

    const now = new Date();
    setConfirmationStartTime(now);
    setTimerStartTimestamp(now.getTime());
    setElapsedSeconds(0);
    setIsPaused(false);

    const expandFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("expanded"));
    });

    const count = 200;
    const defaults = { origin: { y: 0.7 } };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });

    return () => cancelAnimationFrame(expandFrame);
  }, [pendingWinner.id]);

  useEffect(() => {
    if (!timerStartTimestamp || isPaused || !isExpanded) return;
    if (winnerMessages.length > 0) {
      setIsPaused(true);
    }
  }, [winnerMessages, timerStartTimestamp, isPaused, isExpanded]);

  useEffect(() => {
    if (!confirmationStartTime || isPaused || !isExpanded) return;

    const interval = setInterval(() => {
      const diff = Math.floor(
        (Date.now() - confirmationStartTime.getTime()) / 1000
      );
      setElapsedSeconds(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [confirmationStartTime, isPaused, isExpanded]);

  useEffect(() => {
    if (phase !== "collapsing" && phase !== "exiting") return;

    const timeout = window.setTimeout(() => {
      const action = finishActionRef.current;
      finishActionRef.current = null;

      if (action === "cancel") {
        onCancelRef.current();
        return;
      }

      if (action === "confirm") {
        onDismissRef.current();
      }
    }, TRANSITION_MS);

    return () => window.clearTimeout(timeout);
  }, [phase]);

  const handleConfirm = async () => {
    if (isConfirming || phase !== "expanded") return;
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
    if (isConfirming || phase !== "expanded") return;
    finishActionRef.current = "cancel";
    setPhase("exiting");
  };

  return (
    <div
      className={cn(
        "winner-card-shell",
        isExpanded ? "winner-conic-frame" : "winner-card-shell--collapsed",
        phase === "entering" && "winner-card-shell--enter",
        phase === "exiting" && "winner-card-shell--exit"
      )}
    >
      <div
        className={cn(
          "relative z-10 transition-[padding,border-radius] duration-300 ease-out",
          isExpanded
            ? "space-y-2.5 rounded-[calc(var(--radius)-1px)] bg-card p-2.5"
            : "flex items-center gap-3 rounded-lg bg-transparent p-3"
        )}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold transition-all duration-300 ease-out overflow-hidden",
              isExpanded
                ? "w-0 h-8 opacity-0 scale-75"
                : "w-8 h-8 opacity-100 scale-100"
            )}
          >
            {rank}
          </div>

          <Avatar
            className={cn(
              "shrink-0 transition-all duration-300 ease-out",
              isExpanded ? "size-9" : "size-10"
            )}
          >
            <AvatarImage src={pendingWinner.avatar} />
            <AvatarFallback>
              {pendingWinner.displayName[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p
                className={cn(
                  "truncate transition-all duration-300",
                  isExpanded ? "text-sm font-bold" : "text-sm font-medium"
                )}
              >
                {pendingWinner.displayName}
              </p>

              <div
                className={cn(
                  "transition-all duration-300 ease-out overflow-hidden",
                  isExpanded ? "max-w-24 opacity-100" : "max-w-0 opacity-0"
                )}
              >
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 whitespace-nowrap"
                >
                  {winnerMessages.length > 0 ? "respondeu" : "novo"}
                </Badge>
              </div>

              {pendingWinner.subscriber && isExpanded && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Star className="size-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Subscriber</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                detailsOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                  {pendingWinner.subscriber && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Sub
                    </Badge>
                  )}
                  <SubscriptionTierBadge tier={pendingWinner.tier} />
                  {pendingWinner.subscriptionMonths != null &&
                    pendingWinner.subscriptionMonths > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {pendingWinner.subscriptionMonths}{" "}
                        {pendingWinner.subscriptionMonths === 1
                          ? "mês"
                          : "meses"}
                      </Badge>
                    )}
                  <span
                    className={`inline-flex items-center gap-1 font-mono text-[10px] ${
                      isPaused ? "text-orange-500" : "text-muted-foreground"
                    }`}
                  >
                    <Clock className="size-3" />
                    {formatElapsedTime(elapsedSeconds)}
                    {isPaused && <span className="font-sans">pausado</span>}
                  </span>
                </div>
              </div>
            </div>

            <p
              className={cn(
                "text-xs text-muted-foreground transition-all duration-300 ease-out overflow-hidden",
                isExpanded ? "max-h-0 opacity-0 mt-0" : "max-h-5 opacity-100"
              )}
            >
              {new Date().toLocaleTimeString("pt-BR")}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            detailsOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-2.5 pt-0.5">
              <div className="overflow-hidden rounded-md border bg-background">
                <ChatContainer
                  messages={winnerMessages}
                  className="h-[88px] overflow-auto"
                  emptyState={
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Aguardando mensagem do vencedor…
                    </p>
                  }
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isRedrawing || isConfirming}
                >
                  Cancelar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRedraw}
                  disabled={isRedrawing || isConfirming}
                >
                  {isRedrawing ? (
                    <XIcon className="size-3.5 animate-spin" />
                  ) : (
                    <XIcon className="size-3.5" />
                  )}
                  {isRedrawing ? "Sorteando..." : "Refazer"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isRedrawing || isConfirming}
                  loading={isConfirming && phase === "expanded"}
                >
                  <CheckIcon className="size-3.5" />
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
