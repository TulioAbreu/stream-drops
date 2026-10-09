import { InventoryPanel } from "@/components/shell/inventory-panel";
import { LogoutDialog } from "@/components/logout-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import { useLoginStore } from "@/storage/login";
import { LogOutIcon } from "lucide-react";

export function AccountPanel() {
  const { t } = useTranslation();
  const { userData, isLoading } = useTwitchApi();
  const twitchAccessToken = useLoginStore((state) => state.twitchAccessToken);
  const waiting = Boolean(twitchAccessToken) && !userData && isLoading;

  return (
    <InventoryPanel title={t("SETTINGS_ACCOUNT_TITLE")}>
      <div className="flex items-center gap-3">
        {userData ? (
          <>
            <Avatar>
              <AvatarImage
                src={userData.profileImageUrl}
                alt={userData.displayName}
              />
              <AvatarFallback>
                {userData.displayName.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{userData.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {t("SETTINGS_ACCOUNT_STATUS")}
              </p>
            </div>
          </>
        ) : waiting ? (
          <>
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </>
        ) : (
          <p className="flex-1 text-sm text-muted-foreground">
            {t("SETTINGS_ACCOUNT_SIGNED_OUT")}
          </p>
        )}
        <LogoutDialog
          trigger={
            <Button variant="outline" size="sm">
              <LogOutIcon className="size-3.5" />
              {t("SETTINGS_ACCOUNT_LOGOUT")}
            </Button>
          }
        />
      </div>
    </InventoryPanel>
  );
}
