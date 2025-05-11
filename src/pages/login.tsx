import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import { TWITCH_CLIENT_ID } from "@/settings";
import { useLoginStore } from "@/storage/login";
import { AvatarImage } from "@radix-ui/react-avatar";
import { useEffect, useState } from "react";

const AUTHORIZATION_URL = new URL("/oauth2/authorize", "https://id.twitch.tv");
AUTHORIZATION_URL.searchParams.set("client_id", TWITCH_CLIENT_ID);
AUTHORIZATION_URL.searchParams.set("redirect_uri", "http://localhost:3000/auth");
AUTHORIZATION_URL.searchParams.set("response_type", "token");
AUTHORIZATION_URL.searchParams.set("scope", "user:read:subscriptions");

export function LoginPage() {
    const { t } = useTranslation();
    const [isLoadingTwitch, setIsLoadingTwitch] = useState<boolean>(false);
    const { setTwitchAccessToken } = useLoginStore();
    const { userData } = useTwitchApi();


    const handleLoginTwitch = () => {
        // TODO: Implement timeout for the popup
        setIsLoadingTwitch(true);
        window.open(AUTHORIZATION_URL, "newwindow", "width=400,height=600,status=no,toolbar=no,menubar=no,location=no");
        window.addEventListener("message", (event) => {
            const accessToken = event.data.accessToken;
            setTwitchAccessToken(accessToken);
        });
    };

    useEffect(() => {
        if (userData) {
            setIsLoadingTwitch(false);
        }
    }, [userData])

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <Card className="w-[400px]">
                <CardHeader>
                    <CardTitle>
                        {t("LOGIN_TITLE")}
                    </CardTitle>
                    <CardDescription>
                        Faça o login nas plataformas abaixo para continuar
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                        ): (
                            <Button variant="default" className="w-full" onClick={handleLoginTwitch}>
                                {t("LOGIN_BUTTON_TWITCH")}
                            </Button>
                        )
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
