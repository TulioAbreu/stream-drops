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
import {
    isTwitchStubMode,
    openTwitchLoginPopup,
    STUB_ACCESS_TOKEN,
} from "@/lib/twitch-oauth";
import { useQueryClient } from "@tanstack/react-query";

export function SessionExpiredModal() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { sessionExpired, setSessionExpired, setTwitchAccessToken } = useLoginStore();
    const [isLoadingTwitch, setIsLoadingTwitch] = useState(false);
    const stubMode = isTwitchStubMode();

    const handleLoginTwitch = async () => {
        setIsLoadingTwitch(true);
        if (stubMode) {
            // Força novo fetch mesmo se o token stub já estava no store
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
            <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} hideCloseButton={true}>
                <DialogHeader>
                    <DialogTitle>{t("SESSION_EXPIRED_TITLE")}</DialogTitle>
                    <DialogDescription>
                        {stubMode
                            ? t("SESSION_EXPIRED_DESCRIPTION_STUB")
                            : t("SESSION_EXPIRED_DESCRIPTION")}
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
                            {stubMode
                                ? t("LOGIN_BUTTON_TWITCH_STUB")
                                : t("LOGIN_BUTTON_TWITCH")}
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
