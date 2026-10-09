import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { wipeLocalData } from "@/database/clear-browser-data";
import {
  downloadLocalDatabaseBackup,
  readLocalDatabaseBackup,
} from "@/database/export-backup";
import { useTranslation } from "@/i18n";
import { Download } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

interface DeleteLocalDataDialogProps {
  trigger: React.ReactNode;
  /** Navegação depois de apagar. O padrão recarrega a home. */
  leave?: () => void;
}

function redirectHome() {
  window.location.href = "/";
}

function phraseMatches(phrase: string, word: string) {
  return (
    phrase.trim().toLocaleUpperCase("pt-BR") ===
    word.trim().toLocaleUpperCase("pt-BR")
  );
}

/**
 * Apagar dados deste navegador. Não é o diálogo de sair.
 * Nada é apagado sem digitar a palavra de confirmação.
 */
export function DeleteLocalDataDialog({
  trigger,
  leave = redirectHome,
}: DeleteLocalDataDialogProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [pending, setPending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const word = t("SETTINGS_DELETE_CONFIRM_WORD");
  const confirmed = phraseMatches(phrase, word);

  const erasedItems = [
    t("SETTINGS_DELETE_ITEM_GIVEAWAYS"),
    t("SETTINGS_DELETE_ITEM_DATABASES"),
    t("SETTINGS_DELETE_ITEM_STORAGE"),
  ];

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) setPhrase("");
  };

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

  const handleConfirm = async () => {
    if (!confirmed || pending) return;
    setPending(true);
    let blockedNotice = false;
    try {
      await wipeLocalData({
        onBlocked: () => {
          if (blockedNotice) return;
          blockedNotice = true;
          toast.warning(t("SETTINGS_DELETE_BLOCKED"));
        },
      });
      leave();
    } catch (error) {
      console.error("Erro ao apagar dados locais:", error);
      toast.error(t("SETTINGS_DELETE_ERROR"));
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{t("SETTINGS_DELETE_DIALOG_TITLE")}</DialogTitle>
        <DialogDescription>
          {t("SETTINGS_DELETE_DIALOG_DESCRIPTION")}
        </DialogDescription>
        <ul className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-[var(--sd-surface-2)] px-4 py-3 text-sm">
          {erasedItems.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="text-[var(--sd-danger)]">
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[color-mix(in_srgb,var(--sd-local)_22%,transparent)] bg-[var(--sd-local-soft)] px-3 py-2.5">
          <p className="min-w-0 flex-1 text-[13px]">
            {t("SETTINGS_DELETE_DIALOG_EXPORT_HINT")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            loading={exporting}
          >
            <Download className="size-3.5" />
            {t("SETTINGS_EXPORT_BACKUP")}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={inputId}>
            {t("SETTINGS_DELETE_CONFIRM_LABEL")}
          </Label>
          <Input
            id={inputId}
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              {t("CANCEL")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!confirmed || pending}
            loading={pending}
          >
            {t("SETTINGS_DELETE_CONFIRM_BUTTON")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
