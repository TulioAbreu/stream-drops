import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GiveawayInfoCardProps {
  title: string;
  className?: string;
  children: ReactNode;
}

export function GiveawayInfoCard({
  title,
  children,
  className = "",
}: GiveawayInfoCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-[140px] flex-1 flex-col rounded-[14px] border border-border bg-card px-4 py-3 shadow-[var(--sd-shadow-1)]",
        className,
      )}
    >
      <p className="font-display text-[28px] leading-none font-extrabold tabular-nums">
        {children}
      </p>
      <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
        {title}
      </p>
    </div>
  );
}
