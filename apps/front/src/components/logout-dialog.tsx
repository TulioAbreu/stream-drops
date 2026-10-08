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
import { useTranslation } from "@/i18n";
import { useLoginStore } from "@/storage/login";
import { LogOutIcon } from "lucide-react";
import { useId, useState } from "react";

interface LogoutDialogProps {
  trigger: React.ReactNode;
  defaultDeleteLocalData?: boolean;
}

/**
 * O mesmo fluxo de sempre: sair, com a opção de apagar dados locais.
 * O checkbox continua obrigatório para apagar; nada é apagado ao abrir.
 */
export function LogoutDialog({
  trigger,
  defaultDeleteLocalData = false,
}: LogoutDialogProps) {
  const { t } = useTranslation();
  const checkboxId = useId();
  const [deleteLocalData, setDeleteLocalData] = useState(
    defaultDeleteLocalData,
  );
  const setTwitchAccessToken = useLoginStore(
    (state) => state.setTwitchAccessToken,
  );

  const handleLogout = () => {
    if (deleteLocalData) {
      localStorage.clear();
      indexedDB.databases().then((dbs) => {
        dbs.forEach((db) => {
          indexedDB.deleteDatabase(db.name!);
        });
      });
    } else {
      setTwitchAccessToken(null);
    }
    window.location.href = "/";
  };

  return (
    <Dialog>
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
          <Button variant="destructive" onClick={handleLogout}>
            <LogOutIcon className="h-4 w-4" />
            {t("SIDEBAR_LOGOUT_BUTTON")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
