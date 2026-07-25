import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useLoginStore } from "@/storage/login";
import { useEffect, useState } from "react";
import { Skeleton } from "./ui/skeleton";
import { openTwitchLoginPopup } from "@/lib/twitch-oauth";

export function SessionExpiredModal() {
    const { t } = useTranslation();
    const { sessionExpired, setSessionExpired, setTwitchAccessToken } = useLoginStore();
    const [isLoadingTwitch, setIsLoadingTwitch] = useState(false);

    const handleLoginTwitch = () => {
        setIsLoadingTwitch(true);
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

    // Prevent closing by clicking outside or escape key
    // We can use onOpenChange prevent default if open is true?
    // Or just not provide onOpenChange so it's controlled.
    // Dialog component from shadcn usually allows closing via X or outside click.
    // We want to force re-login. So we should probably disable closing.
    // But maybe user wants to logout? I should provide a logout button too.

    const handleLogout = () => {
        localStorage.clear();
        indexedDB.databases().then((dbs) => {
            dbs.forEach((db) => {
                indexedDB.deleteDatabase(db.name!);
            });
        });
        window.location.href = "/";
    };


    return (
        <Dialog open={sessionExpired} onOpenChange={(open) => {
            if (!open) {
                // Prevent closing if we are just clicking outside
                // But maybe allow closing if they want to give up? 
                // If they close, the app is still in a broken state (token invalid).
                // So we should force decision.
            }
        }}>
            <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} hideCloseButton={true}>
                <DialogHeader>
                    <DialogTitle>{t("SESSION_EXPIRED_TITLE")}</DialogTitle>
                    <DialogDescription>
                        {t("SESSION_EXPIRED_DESCRIPTION")}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    {isLoadingTwitch ? (
                        <div className="flex flex-row items-center p-4 border rounded shadow-md gap-4">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div>
                                <p>Twitch</p>
                                <Skeleton className="w-50 h-5" />
                            </div>
                        </div>
                    ) : (
                        <Button onClick={handleLoginTwitch} className="w-full">
                            {t("LOGIN_BUTTON_TWITCH")}
                        </Button>
                    )}

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                {t("OR")}
                            </span>
                        </div>
                    </div>

                    <Button variant="outline" onClick={handleLogout} className="w-full">
                        {t("SIDEBAR_LOGOUT_BUTTON")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
