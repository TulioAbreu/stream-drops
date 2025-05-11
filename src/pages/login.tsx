import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import { TWITCH_CLIENT_ID } from "@/settings";
import { useLoginStore } from "@/storage/login";
import { AvatarImage } from "@radix-ui/react-avatar";
import { CheckIcon, Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

const AUTHORIZATION_URL = new URL("/oauth2/authorize", "https://id.twitch.tv");
AUTHORIZATION_URL.searchParams.set("client_id", TWITCH_CLIENT_ID);
AUTHORIZATION_URL.searchParams.set("redirect_uri", "http://localhost:3000/auth");
AUTHORIZATION_URL.searchParams.set("response_type", "token");
AUTHORIZATION_URL.searchParams.set("scope", "user:read:subscriptions");

const AUTHORIZATION_DRIVE_URL = new URL("/o/oauth2/v2/auth", "https://accounts.google.com");
AUTHORIZATION_DRIVE_URL.searchParams.set("client_id", "790178845295-d80705l73fje56tomu29lnmlspl85lnt.apps.googleusercontent.com");
AUTHORIZATION_DRIVE_URL.searchParams.set("redirect_uri", "http://localhost:3000/auth/drive");
AUTHORIZATION_DRIVE_URL.searchParams.set("response_type", "code");
const SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
]
AUTHORIZATION_DRIVE_URL.searchParams.set("scope", SCOPES.join(" "));
AUTHORIZATION_DRIVE_URL.searchParams.set("access_type", "offline");
AUTHORIZATION_DRIVE_URL.searchParams.set("prompt", "consent");

export function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { setTwitchAccessToken, setDriveCode, driveCode, twitchAccessToken } = useLoginStore();
    const { userData } = useTwitchApi();
    const [isLoadingTwitch, setIsLoadingTwitch] = useState<boolean>(false);
    const [isLoadingDrive, setIsLoadingDrive] = useState<boolean>(false);

    const handleLoginTwitch = () => {
        // TODO: Implement timeout for the popup
        setIsLoadingTwitch(true);
        window.open(AUTHORIZATION_URL, "newwindow", "width=400,height=600,status=no,toolbar=no,menubar=no,location=no");
        window.addEventListener("message", (event) => {
            if (event.data.type !== "twitch-auth") {
                return;
            }
            const accessToken = event.data.accessToken;
            setTwitchAccessToken(accessToken);
        });
    };

    const handleLoginGoogleDrive = () => {
        window.open(AUTHORIZATION_DRIVE_URL, "newwindow", "width=400,height=600,status=no,toolbar=no,menubar=no,location=no");
        window.addEventListener("message", (event) => {
            if (event.data.type !== "drive-auth") {
                return;
            }
            const code = event.data.code;
            setDriveCode(code);
        });
    };

    useEffect(() => {
        if (userData) {
            setIsLoadingTwitch(false);
        }
    }, [userData]);

    useEffect(() => {
        if (!driveCode || !twitchAccessToken) {
            return;
        }
        setTimeout(() => {
            navigate("/dashboard");
        }, 1000);
    }, [driveCode, twitchAccessToken]);

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
                        ): (
                            <Button variant="default" className="w-full" onClick={handleLoginTwitch}>
                                {t("LOGIN_BUTTON_TWITCH")}
                            </Button>
                        )
                    )}
                    {driveCode ? (
                        <div className="flex flex-row items-center p-4 border rounded shadow-md gap-4">
                            {isLoadingDrive ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin text-blue-500" />
                                    <p>Autenticando Google Drive...</p>
                                </>
                            ) : (
                                <>
                                    <CheckIcon className="w-5 h-5 text-green-500" />
                                    <p>Google Drive autenticado.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <Button variant="default" className="w-full mt-4" onClick={handleLoginGoogleDrive}>
                            {t("LOGIN_BUTTON_GOOGLE_DRIVE")}
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
