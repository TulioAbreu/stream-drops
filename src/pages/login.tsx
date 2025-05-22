import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import { useLoginStore } from "@/storage/login";
import { AvatarImage } from "@radix-ui/react-avatar";
import { CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

const AUTHORIZATION_URL = new URL("/oauth2/authorize", "https://id.twitch.tv");
AUTHORIZATION_URL.searchParams.set("client_id", import.meta.env.VITE_TWITCH_CLIENT_ID);
AUTHORIZATION_URL.searchParams.set("redirect_uri", import.meta.env.VITE_TWITCH_REDIRECT_URL);
AUTHORIZATION_URL.searchParams.set("response_type", "token");
AUTHORIZATION_URL.searchParams.set("scope", "channel:read:subscriptions");

export function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { twitchAccessToken } = useLoginStore();
    const { userData } = useTwitchApi();
    const [isLoadingTwitch, setIsLoadingTwitch] = useState<boolean>(false);

    const handleLoginTwitch = () => {
        setIsLoadingTwitch(true);
        window.open(
            AUTHORIZATION_URL,
            "twitch-login",
            "width=500,height=600"
        );

    };

    useEffect(() => {
        if (userData) {
            setIsLoadingTwitch(false);
        }
    }, [userData]);

    useEffect(() => {
        if (!twitchAccessToken) {
            return;
        }
        setTimeout(() => {
            navigate("/dashboard");
        }, 1000);
    }, [twitchAccessToken]);

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <Card className="w-[400px]">
                <CardHeader>
                    <CardTitle>
                        {t("LOGIN_TITLE")}
                    </CardTitle>
                    <CardDescription>
                        {t("LOGIN_DESCRIPTION")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {userData ? (
                        <div className="flex flex-row items-center p-4 border rounded shadow-md gap-4">
                            <Avatar>
                                <AvatarImage src={userData.profileImageUrl} alt={userData.displayName} />
                                <AvatarFallback>{userData.displayName.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p>Twitch</p>
                                <p className="font-bold">{userData.login}</p>
                            </div>
                        </div>
                    ) : (
                        isLoadingTwitch ? (
                            <div className="flex flex-row items-center p-4 border rounded shadow-md gap-4">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div>
                                    <p>Twitch</p>
                                    <Skeleton className="w-50 h-5" />
                                </div>
                            </div>
                        ) : (
                            <Button variant="default" className="w-full" onClick={handleLoginTwitch}>
                                {t("LOGIN_BUTTON_TWITCH")}
                            </Button>
                        )
                    )}
                    {twitchAccessToken && (
                        <div className="flex flex-row items-center p-4 border rounded shadow-md gap-4">
                            <CheckIcon className="w-5 h-5 text-green-500" />
                            <p>Tudo pronto, finalizando login...</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
