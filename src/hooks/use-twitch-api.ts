import { useEffect, useState } from "react";
import { makeTwitchApiClient } from "@/service/twitch";
import { makeTwitchIdApiClient } from "@/service/twitch-id";
import { TWITCH_CLIENT_ID } from "@/settings";
import { useLoginStore } from "@/storage/login";

interface TwitchUser {
    id: string;
    login: string;
    displayName: string;
    profileImageUrl: string;
    expiresIn: number;
}

export function useTwitchApi() {
    const { twitchAccessToken } = useLoginStore();
    const [twitchApiClient, setTwitchApiClient] = useState<ReturnType<typeof makeTwitchApiClient> | null>(null);
    const [isTokenValid, setIsTokenValid] = useState(false);
    const [userData, setUserData] = useState<TwitchUser | null>(null);

    useEffect(() => {
        if (!twitchAccessToken) {
            console.warn("Nenhum token de acesso encontrado.");
            setIsTokenValid(false);
            setUserData(null);
            setTwitchApiClient(null);
            return;
        }

        const twitchIdClient = makeTwitchIdApiClient();

        const validateToken = async () => {
            const result = await twitchIdClient.validateToken(twitchAccessToken);
            if (result.isOk()) {
                const { client_id, user_id, expires_in } = result.value;

                // Verifica se o token pertence ao cliente correto
                if (client_id === TWITCH_CLIENT_ID) {
                    setIsTokenValid(true);

                    // Inicializa o cliente da API da Twitch
                    const apiClient = makeTwitchApiClient({
                        clientId: TWITCH_CLIENT_ID,
                        accessToken: twitchAccessToken,
                    });
                    setTwitchApiClient(apiClient);

                    // Faz uma nova requisição para obter o profileImageUrl
                    const userResult = await apiClient.getUsers({ id: user_id });
                    if (userResult.isOk() && userResult.value.data.length > 0) {
                        const user = userResult.value.data[0];
                        setUserData({
                            id: user.id,
                            login: user.login,
                            displayName: user.display_name,
                            profileImageUrl: user.profile_image_url,
                            expiresIn: expires_in,
                        });
                    } else {
                        console.error("Erro ao obter dados do usuário:", userResult.isErr() && userResult.error);
                        setUserData(null);
                    }
                } else {
                    console.error("O token não pertence ao cliente configurado.");
                    setIsTokenValid(false);
                    setUserData(null);
                    setTwitchApiClient(null);
                }
            } else {
                console.error("Token inválido ou expirado.");
                setIsTokenValid(false);
                setUserData(null);
                setTwitchApiClient(null);
            }
        };

        // Valida o token ao montar o hook
        validateToken();

        // Valida o token periodicamente (ex.: a cada 5 minutos)
        const interval = setInterval(validateToken, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [twitchAccessToken]);

    return { twitchApiClient, isTokenValid, userData };
}