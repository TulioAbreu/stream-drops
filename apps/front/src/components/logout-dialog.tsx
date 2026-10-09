import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { wipeLocalData } from "@/database/clear-browser-data";
import { useTranslation } from "@/i18n";
import { useLoginStore } from "@/storage/login";
import { LogOutIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

interface LogoutDialogProps {
  trigger: React.ReactNode;
  /** Navegação depois de sair. O padrão recarrega a home. */
  leave?: () => void;
}

function redirectHome() {
  window.location.href = "/";
}

/**
 * Sair da conta. A caixa de apagar dados começa desmarcada
 * e volta a desmarcar cada vez que o diálogo abre.
 */
export function LogoutDialog({
  trigger,
  leave = redirectHome,
}: LogoutDialogProps) {
  const { t } = useTranslation();
  const checkboxId = useId();
  const [open, setOpen] = useState(false);
  const [deleteLocalData, setDeleteLocalData] = useState(false);
  const [pending, setPending] = useState(false);
  const setTwitchAccessToken = useLoginStore(
    (state) => state.setTwitchAccessToken,
  );

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (next) setDeleteLocalData(false);
  };

  const handleLogout = async () => {
    if (pending) return;
    if (deleteLocalData) {
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
      } catch (error) {
        console.error("Erro ao apagar dados no logout:", error);
        toast.error(t("SETTINGS_DELETE_ERROR"));
        setPending(false);
        return;
      }
    } else {
      setTwitchAccessToken(null);
    }
    leave();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{t("SIDEBAR_LOGOUT_DIALOG_TITLE")}</DialogTitle>
        <DialogDescription>
          {t("SIDEBAR_LOGOUT_DIALOG_DESCRIPTION")}
        </DialogDescription>
        <div className="flex items-center space-x-2 py-4">
          <Checkbox
            id={checkboxId}
            checked={deleteLocalData}
            onCheckedChange={(checked) =>
              setDeleteLocalData(checked === true)
            }
          />
          <Label
            htmlFor={checkboxId}
            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {t("SIDEBAR_LOGOUT_DELETE_DATA_LABEL")}
          </Label>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={handleLogout}
            loading={pending}
          >
            <LogOutIcon className="h-4 w-4" />
            {t("SIDEBAR_LOGOUT_BUTTON")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
