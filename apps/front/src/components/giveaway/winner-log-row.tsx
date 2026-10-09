import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EngineClock, WinEvent } from "@/lib/winner-badges/types";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { WinnerBadgeSurface } from "./winner-badge-surface";

export interface WinnerLogRowProps {
  rank: number;
  name: string;
  avatar?: string;
  drawnAt: string;
  tier?: null | 1000 | 2000 | 3000;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
  dimmed?: boolean;
  /** Vitória confirmada. Sem ela, a linha não mostra selos. */
  badgeWin?: WinEvent | null;
  /** Fuso do cálculo. Sem ele, usa o fuso do navegador. */
  badgeClock?: EngineClock;
}

function tierAccent(tier: WinnerLogRowProps["tier"]): string | undefined {
  if (tier === 3000) return "var(--rarity-legendary)";
  if (tier === 2000) return "var(--rarity-epic)";
  if (tier === 1000) return "var(--rarity-rare)";
  return undefined;
}

export function WinnerLogRow({
  rank,
  name,
  avatar,
  drawnAt,
  tier,
  onRemove,
  removeLabel = "Remover vencedor",
  className,
  dimmed = false,
  badgeWin = null,
  badgeClock,
}: WinnerLogRowProps) {
  const accent = tierAccent(tier) ?? "var(--border)";
  const drawnLabel = new Date(drawnAt).toLocaleTimeString("pt-BR");

  return (
    <div
      data-winner-item
      className={cn(
        "relative flex items-center gap-3 rounded-[10px] border border-border bg-[var(--sd-surface-2)] px-3 py-2.5",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full"
        style={{ background: accent }}
      />
      <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-muted-foreground">
        #{rank}
      </span>
      <Avatar className="size-8">
        {avatar ? <AvatarImage src={avatar} alt="" /> : null}
        <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className={cn(
              "truncate text-[15px] font-bold",
              dimmed ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {name}
          </p>
          <WinnerBadgeSurface surface="log" win={badgeWin} clock={badgeClock} />
        </div>
        <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
          {drawnLabel}
        </p>
      </div>
      {tier ? (
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold text-foreground"
          style={{
            borderColor: `color-mix(in srgb, ${accent} 55%, transparent)`,
          }}
        >
          Tier {tier / 1000}
        </span>
      ) : null}
      {onRemove ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onRemove}
                aria-label={removeLabel}
              >
                <XIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{removeLabel}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
