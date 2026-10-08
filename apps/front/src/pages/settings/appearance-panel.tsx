import { InventoryPanel } from "@/components/shell/inventory-panel";
import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

const OPTIONS: {
  value: "dark" | "light" | "system";
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "dark", label: "SETTINGS_APPEARANCE_DARK", icon: Moon },
  { value: "light", label: "SETTINGS_APPEARANCE_LIGHT", icon: Sun },
  { value: "system", label: "SETTINGS_APPEARANCE_SYSTEM", icon: Monitor },
];

export function AppearancePanel() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <InventoryPanel title={t("SETTINGS_APPEARANCE_TITLE")}>
      <div className="flex gap-2.5">
        {OPTIONS.map((option) => {
          const active = theme === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme(option.value)}
              className={cn(
                "flex h-16 flex-1 items-center justify-center gap-2.5 rounded-[10px] border border-border bg-[var(--sd-surface-2)] text-sm font-semibold",
                active &&
                  "border-[color-mix(in_srgb,var(--sd-rarity-legendary)_70%,transparent)] shadow-[var(--sd-glow-legendary)]",
              )}
            >
              <Icon
                className={cn(
                  "size-4",
                  active && "text-[var(--sd-brand-amber-strong)]",
                )}
              />
              {t(option.label)}
            </button>
          );
        })}
      </div>
    </InventoryPanel>
  );
}
