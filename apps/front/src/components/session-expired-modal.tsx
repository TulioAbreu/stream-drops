import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/i18n";
import {
  isTwitchStubMode,
  openTwitchLoginPopup,
  STUB_ACCESS_TOKEN,
} from "@/lib/twitch-oauth";
import { useLoginStore } from "@/storage/login";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, LogOutIcon } from "lucide-react";
import { useEffect, useState } from "react";

export function SessionExpiredModal() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { sessionExpired, setSessionExpired, setTwitchAccessToken } =
    useLoginStore();
  const [isLoadingTwitch, setIsLoadingTwitch] = useState(false);
  const stubMode = isTwitchStubMode();

  const handleLoginTwitch = async () => {
    setIsLoadingTwitch(true);
    if (stubMode) {
      setTwitchAccessToken(null);
      await queryClient.resetQueries({ queryKey: ["twitchUser"] });
      setSessionExpired(false);
      setTwitchAccessToken(STUB_ACCESS_TOKEN);
      setIsLoadingTwitch(false);
      return;
    }
    openTwitchLoginPopup();
  };

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "twitch-auth" && event.data.accessToken) {
        setTwitchAccessToken(event.data.accessToken);
        setSessionExpired(false);
        setIsLoadingTwitch(false);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setTwitchAccessToken, setSessionExpired]);

  const handleLogout = () => {
    setSessionExpired(false);
    setTwitchAccessToken(null);
    window.location.href = "/";
  };

  return (
    <Dialog open={sessionExpired} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[440px]"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        hideCloseButton
      >
        <p className="text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
          {t("SESSION_EXPIRED_EYEBROW")}
        </p>
        <DialogTitle className="font-display text-[30px] leading-none font-extrabold">
          {t("SESSION_EXPIRED_TITLE")}
        </DialogTitle>
        <DialogDescription>
          {stubMode
            ? t("SESSION_EXPIRED_DESCRIPTION_STUB")
            : t("SESSION_EXPIRED_DESCRIPTION")}
        </DialogDescription>
        <p className="text-sm text-muted-foreground">
          {t("SESSION_EXPIRED_DATA_STAYS")}
        </p>
        <div className="flex flex-col gap-3 pt-1">
          {isLoadingTwitch ? (
            <div className="flex items-center gap-4 rounded-xl border border-border p-4">
              <Skeleton className="size-10 rounded-full" />
              <div>
                <p>Twitch</p>
                <Skeleton className="h-5 w-40" />
              </div>
            </div>
          ) : (
            <Button className="h-[50px] w-full text-base" onClick={handleLoginTwitch}>
              <Link2 className="size-5" />
              {stubMode
                ? t("LOGIN_BUTTON_TWITCH_STUB")
                : t("LOGIN_BUTTON_TWITCH")}
            </Button>
          )}
          <Button variant="outline" onClick={handleLogout} className="w-full">
            <LogOutIcon className="size-4" />
            {t("SIDEBAR_LOGOUT_BUTTON")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
