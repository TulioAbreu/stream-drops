import { DeleteLocalDataDialog } from "@/components/delete-local-data-dialog";
import { InventoryPanel } from "@/components/shell/inventory-panel";
import { formatByteSize } from "@/lib/format-byte-size";
import { Button } from "@/components/ui/button";
import {
  downloadLocalDatabaseBackup,
  readLocalDatabaseBackup,
} from "@/database/export-backup";
import { useLocalDatabaseSummary } from "@/hooks/use-local-database-summary";
import { useTranslation } from "@/i18n";
import {
  Coins,
  Disc3,
  Download,
  HardDrive,
  MessageSquare,
  Trash2,
  UserRoundCheck,
  Users,
  LayoutTemplate,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STORE_META: Record<string, { label: string; icon: LucideIcon }> = {
  "chat-giveaways": {
    label: "SETTINGS_STORE_CHAT_GIVEAWAYS",
    icon: MessageSquare,
  },
  giveaways: {
    label: "SETTINGS_STORE_SUB_GIVEAWAYS",
    icon: UserRoundCheck,
  },
  "channel-points-giveaways": {
    label: "SETTINGS_STORE_CHANNEL_POINTS",
    icon: Coins,
  },
  roulettes: {
    label: "SETTINGS_STORE_ROULETTES",
    icon: Disc3,
  },
  "exclusion-list": {
    label: "SETTINGS_STORE_EXCLUSION",
    icon: Users,
  },
  "chat-giveaway-templates": {
    label: "SETTINGS_STORE_CHAT_TEMPLATES",
    icon: LayoutTemplate,
  },
  "chat-participants": {
    label: "SETTINGS_STORE_CHAT_PARTICIPANTS",
    icon: Users,
  },
};

const STORE_ORDER = Object.keys(STORE_META);

export function LocalDataPanel() {
  const { t } = useTranslation();
  const summary = useLocalDatabaseSummary();
  const [exporting, setExporting] = useState(false);

  const stores = [...(summary?.stores ?? [])].sort((a, b) => {
    const ai = STORE_ORDER.indexOf(a.name);
    const bi = STORE_ORDER.indexOf(b.name);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const backup = await readLocalDatabaseBackup();
      downloadLocalDatabaseBackup(backup);
      toast.success(t("SETTINGS_EXPORT_BACKUP_SUCCESS"));
    } catch (error) {
      console.error("Erro ao exportar backup:", error);
      toast.error(t("SETTINGS_EXPORT_BACKUP_ERROR"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <InventoryPanel
      title={t("SETTINGS_LOCAL_DATA_TITLE")}
      actions={
        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--sd-local)_22%,transparent)] bg-[var(--sd-local-soft)] px-2.5 text-xs font-semibold text-[var(--sd-local)]">
          <HardDrive className="size-3.5" />
          {summary?.estimatedBytes == null
            ? "—"
            : formatByteSize(summary.estimatedBytes)}
        </span>
      }
    >
      <p className="mb-3 text-[13px] text-muted-foreground">
        {t("SETTINGS_LOCAL_DATA_DESCRIPTION")}
      </p>
      <div className="flex flex-col gap-2">
        {stores.map((store) => {
          const meta = STORE_META[store.name];
          const Icon = meta?.icon ?? HardDrive;
          const label = meta ? t(meta.label) : store.name;
          const count = String(store.count);
          return (
            <div
              key={store.name}
              className="flex items-center gap-3 rounded-[10px] border border-border bg-[var(--sd-surface-2)] px-3 py-2.5"
            >
              <Icon className="size-4 shrink-0 text-[var(--sd-brand-amber-strong)]" />
              <span className="flex-1 text-sm font-semibold">{label}</span>
              <span className="font-mono text-sm text-muted-foreground">
                {count}
              </span>
            </div>
          );
        })}
        {stores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("SETTINGS_LOCAL_DATA_EMPTY")}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          loading={exporting}
          data-testid="export-backup"
        >
          <Download className="size-3.5" />
          {t("SETTINGS_EXPORT_BACKUP")}
        </Button>
        <DeleteLocalDataDialog
          trigger={
            <Button
              variant="outline"
              size="sm"
              className="ml-auto border-transparent bg-[var(--sd-danger-soft)] text-[var(--sd-danger)] hover:bg-[var(--sd-danger-soft)] hover:text-[var(--sd-danger)]"
            >
              <Trash2 className="size-3.5" />
              {t("SETTINGS_DELETE_LOCAL_DATA")}
            </Button>
          }
        />
      </div>
    </InventoryPanel>
  );
}
