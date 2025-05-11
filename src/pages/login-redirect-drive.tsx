import { LoaderCircleIcon } from "lucide-react";
import { useEffect } from "react";

export function LoginRedirectDrivePage() {
    useEffect(() => {
        const hash = document.location.search.toString();
        if (hash) {
            const hashParams = new URLSearchParams(hash);
            const code = hashParams.get("code");
            if (code) {
                window.opener.postMessage({ type: "drive-auth", code }, "*");
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
