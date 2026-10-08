import { InventoryPanel } from "@/components/shell/inventory-panel";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/i18n";
import { useSettingsStore } from "@/storage/settings";

export function BadgesPanel() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((state) => state.badges.enabled);
  const setBadgesEnabled = useSettingsStore((state) => state.setBadgesEnabled);

  return (
    <InventoryPanel title={t("SETTINGS_BADGES_TITLE")}>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <Label htmlFor="settings-badges-enabled">
            {t("SETTINGS_BADGES_TOGGLE_LABEL")}
          </Label>
          <p
            id="settings-badges-description"
            className="mt-1 text-[13px] text-muted-foreground"
          >
            {t("SETTINGS_BADGES_TOGGLE_DESCRIPTION")}
          </p>
        </div>
        <Switch
          id="settings-badges-enabled"
          checked={enabled}
          onCheckedChange={setBadgesEnabled}
          aria-describedby="settings-badges-description"
        />
      </div>
    </InventoryPanel>
  );
}
