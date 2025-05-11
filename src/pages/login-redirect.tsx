import { LoaderCircleIcon } from "lucide-react";
import { useEffect } from "react";

export function LoginRedirectPage() {
    useEffect(() => {
        const hash = document.location.hash.toString();
        if (hash) {
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get("access_token");
            if (accessToken) {
                window.opener.postMessage({ type: "twitch-auth", accessToken }, "*");
            }
        }
        window.close();
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