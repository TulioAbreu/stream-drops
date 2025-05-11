import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { TWITCH_CLIENT_ID } from "@/settings";
import { useLoginStore } from "@/storage/login";
import { useEffect } from "react";
import { useNavigate } from "react-router";

const AUTHORIZATION_URL = new URL("/oauth2/authorize", "https://id.twitch.tv");
AUTHORIZATION_URL.searchParams.set("client_id", TWITCH_CLIENT_ID);
AUTHORIZATION_URL.searchParams.set("redirect_uri", "http://localhost:3000/login");
AUTHORIZATION_URL.searchParams.set("response_type", "token");
AUTHORIZATION_URL.searchParams.set("scope", "user:read:subscriptions");

export function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { twitchAccessToken, setTwitchAccessToken } = useLoginStore();

    const handleLoginTwitch = () => {
        window.open(AUTHORIZATION_URL, "newwindow", "width=400,height=600,status=no,toolbar=no,menubar=no,location=no");
        window.addEventListener("message", (event) => {
            const accessToken = event.data.accessToken;
            setTwitchAccessToken(accessToken);
        });
    };

    useEffect(() => {

    }, [twitchAccessToken]);

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <div className="border rounded shadow-md min-w-[300px] p-4">
                <h1 className="text-2xl font-bold mb-4">
                    {t("LOGIN_TITLE")}
                </h1>
                <Button variant="default" className="w-full" onClick={handleLoginTwitch}>
                    {t("LOGIN_BUTTON_TWITCH")}
                </Button>
            </div>
        </div>
    )
}
