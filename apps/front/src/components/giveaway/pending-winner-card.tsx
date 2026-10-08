import type { EngineClock, WinEvent } from "@/lib/winner-badges/types";
import { WinnerBadgeSurface } from "./winner-badge-surface";

type PendingWinnerCardProps = {
  name: string;
  hint: string;
  win: WinEvent | null;
  clock?: EngineClock;
};

/** Card do pendente no log. A prévia entra depois, sem segurar o sorteio. */
export function PendingWinnerCard({
  name,
  hint,
  win,
  clock,
}: PendingWinnerCardProps) {
  return (
    <div
      data-pending-card
      className="rounded-[14px] border border-dashed border-[var(--sd-border-strong)] bg-card px-3 py-3"
    >
      <p className="text-sm font-semibold">{name}</p>
      <WinnerBadgeSurface
        surface="card"
        preview
        align="start"
        win={win}
        clock={clock}
      />
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
