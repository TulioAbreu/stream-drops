import { useLocalDatabaseSummary } from "@/hooks/use-local-database-summary";
import { useTranslation } from "@/i18n";
import { formatByteSize } from "@/lib/format-byte-size";
import { cn } from "@/lib/utils";
import { HardDrive } from "lucide-react";

const SEGMENT_COLORS = [
  "var(--sd-brand-amber)",
  "var(--sd-rarity-rare)",
  "var(--sd-rarity-epic)",
  "var(--sd-success)",
  "var(--sd-info)",
];

export function BrowserChest({ className }: { className?: string }) {
  const { t } = useTranslation();
  const summary = useLocalDatabaseSummary();
  const stores = (summary?.stores ?? [])
    .filter((store) => store.count > 0)
    .sort((a, b) => b.count - a.count);
  const totalCount = stores.reduce((sum, store) => sum + store.count, 0);
  const estimatedBytes = summary?.estimatedBytes;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-[var(--sd-surface-2)] p-3",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-bold">
        <HardDrive className="size-3.5" />
        <span>{t("SIDEBAR_CHEST_TITLE")}</span>
        <span className="ml-auto font-mono text-[11px] font-medium text-muted-foreground">
          {estimatedBytes == null ? "—" : formatByteSize(estimatedBytes)}
        </span>
      </div>
      <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-[var(--sd-surface-3)]">
        {totalCount > 0
          ? stores.map((store, index) => (
              <span
                key={store.name}
                className="block h-full"
                style={{
                  width: `${(store.count / totalCount) * 100}%`,
                  background: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
                }}
              />
            ))
          : null}
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        {t("SIDEBAR_CHEST_SUMMARY", {
          giveaways: summary?.giveawayCount ?? 0,
          roulettes: summary?.rouletteCount ?? 0,
          exclusions: summary?.exclusionCount ?? 0,
        })}
      </p>
    </div>
  );
}
