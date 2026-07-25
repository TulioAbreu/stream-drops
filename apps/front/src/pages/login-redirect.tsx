import { useLoginStore } from "@/storage/login";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect } from "react";

export function LoginRedirectPage() {
    const { setTwitchAccessToken } = useLoginStore();
    useEffect(() => {
        const hash = document.location.hash.toString();
        if (hash) {
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get("access_token");
            if (accessToken) {
                setTwitchAccessToken(accessToken);
                // Envia o token para a janela que abriu este popup
                if (window.opener) {
                    window.opener.postMessage(
                        { type: "twitch-auth", accessToken },
                        window.location.origin
                    );
                }
                setTimeout(() => {
                    window.close();
                }, 500);
            }
        }
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <LoaderCircleIcon className="animate-spin mb-4" size={48} />
            <h1 className="text-2xl font-bold mb-4">
                Redirecionando...
            </h1>
        </div>
    );
}