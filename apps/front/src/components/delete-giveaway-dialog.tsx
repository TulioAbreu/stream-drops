import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n";
import { useId, useState } from "react";

interface DeleteGiveawayDialogProps {
  trigger: React.ReactNode;
  pending?: boolean;
  /** `true` só quando a caixa de hard delete está marcada. */
  onConfirm: (hardDelete: boolean) => void;
}

/**
 * Excluir sorteio. A caixa de apagar o histórico começa desmarcada
 * e volta a desmarcar cada vez que o diálogo abre.
 */
export function DeleteGiveawayDialog({
  trigger,
  pending = false,
  onConfirm,
}: DeleteGiveawayDialogProps) {
  const { t } = useTranslation();
  const checkboxId = useId();
  const [open, setOpen] = useState(false);
  const [hardDelete, setHardDelete] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (next) setHardDelete(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{t("GIVEAWAY_DELETE_DIALOG_TITLE")}</DialogTitle>
        <DialogDescription>
          {t("GIVEAWAY_DELETE_DIALOG_DESCRIPTION")}
        </DialogDescription>
        <div className="flex items-start gap-2.5 rounded-[10px] border border-[color-mix(in_srgb,var(--sd-danger)_35%,transparent)] bg-[var(--sd-danger-soft)] px-3 py-2.5">
          <Checkbox
            id={checkboxId}
            checked={hardDelete}
            disabled={pending}
            onCheckedChange={(checked) => setHardDelete(checked === true)}
            className="mt-0.5 border-[var(--sd-danger)] data-[state=checked]:border-[var(--sd-danger)] data-[state=checked]:bg-[var(--sd-danger)]"
          />
          <Label
            htmlFor={checkboxId}
            className="text-sm leading-snug font-medium text-[var(--sd-danger)]"
          >
            {t("GIVEAWAY_DELETE_DIALOG_HARD_LABEL")}
          </Label>
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
            loading={pending}
            onClick={() => {
              if (pending) return;
              onConfirm(hardDelete);
            }}
          >
            {t("DELETE")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
