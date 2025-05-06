import { Button } from "@/components/ui/button";
import { T } from "@/i18n";
import { useLoginStore } from "@/storage/login";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export function LoginPage() {
    const navigate = useNavigate();
    const { isLoggedIn, setIsLoggedIn } = useLoginStore();

    useEffect(() => {
        if (isLoggedIn) {
            navigate("/dashboard");
        }
    }, [isLoggedIn]);

    const handleLogin = () => {
        setIsLoggedIn(true);
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <div className="border rounded shadow-md min-w-[300px] p-4">
                <h1 className="text-2xl font-bold mb-4">
                    {T["LOGIN_TITLE"]}
                </h1>
                <Button variant="default" className="w-full" onClick={handleLogin}>
                    {T["LOGIN_BUTTON_TWITCH"]}
                </Button>
            </div>
        </div>
    )
}
