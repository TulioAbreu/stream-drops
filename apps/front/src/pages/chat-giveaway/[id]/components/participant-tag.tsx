import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatParticipant } from "../../types";

function getMonthsBorderGradient(months: number | undefined): string | null {
  if (!months) return null;
  if (months >= 48) return "from-purple-500 via-pink-500 to-cyan-500";
  if (months >= 36) return "from-yellow-400 via-yellow-500 to-yellow-400";
  if (months >= 24) return "from-purple-500 via-purple-600 to-purple-500";
  if (months >= 12) return "from-blue-500 via-blue-600 to-blue-500";
  return null;
}

function getStarClass(
  subscriber: boolean,
  tier?: ChatParticipant["tier"]
): string {
  if (!subscriber) {
    return "text-muted-foreground/40 fill-transparent";
  }
  switch (tier) {
    case 3000:
      return "text-orange-400 fill-orange-500";
    case 2000:
      return "text-gray-300 fill-gray-400";
    case 1000:
      return "text-white fill-white";
    default:
      return "text-yellow-500 fill-yellow-500";
  }
}

interface ParticipantTagProps {
  participant: Pick<
    ChatParticipant,
    "displayName" | "subscriber" | "tier" | "subscriptionMonths"
  >;
  className?: string;
}

export function ParticipantTag({ participant, className }: ParticipantTagProps) {
  const gradient = getMonthsBorderGradient(participant.subscriptionMonths);
  const monthsLabel =
    participant.subscriptionMonths && participant.subscriptionMonths >= 12
      ? `${participant.subscriptionMonths}m`
      : null;

  const inner = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/90 px-3 py-1 text-xs font-semibold">
      <Star
        className={cn(
          "size-4 shrink-0",
          getStarClass(participant.subscriber, participant.tier)
        )}
      />
      {participant.displayName}
      {monthsLabel && (
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {monthsLabel}
        </span>
      )}
    </span>
  );

  if (!gradient) {
    return (
      <span
        className={cn(
          "inline-flex rounded-full border border-dashed border-border/70",
          className
        )}
      >
        {inner}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full p-[2px]",
        "bg-gradient-to-r bg-[length:200%_100%] animate-[gradient_3s_ease_infinite]",
        gradient,
        className
      )}
    >
      {inner}
    </span>
  );
}
