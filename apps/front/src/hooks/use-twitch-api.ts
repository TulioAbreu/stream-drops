import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { makeTwitchApiClient } from "@/service/twitch";
import { makeTwitchIdApiClient } from "@/service/twitch-id";
import { useLoginStore } from "@/storage/login";
import { err } from "neverthrow";

interface TwitchUser {
    id: string;
    login: string;
    displayName: string;
    profileImageUrl: string;
    expiresIn: number;
    broadcasterType: string;
    scopes: string[];
}

export type TwitchApiClient = ReturnType<typeof makeTwitchApiClient>;

// Função para validar token e obter dados do usuário
async function fetchTwitchUserData(twitchAccessToken: string): Promise<TwitchUser | null> {
    if (!twitchAccessToken) {
        throw new Error("Token de acesso não encontrado");
    }

    const twitchIdClient = makeTwitchIdApiClient();
    const result = await twitchIdClient.validateToken(twitchAccessToken);
    
    if (!result.isOk()) {
        throw new Error("Token inválido ou expirado");
    }

    const { client_id, user_id, expires_in, scope } = result.value;

    // Verifica se o token pertence ao cliente correto
    if (client_id !== import.meta.env.VITE_TWITCH_CLIENT_ID) {
        throw new Error("O token não pertence ao cliente configurado");
    }

    // Inicializa o cliente da API da Twitch
    const apiClient = makeTwitchApiClient({
        clientId: import.meta.env.VITE_TWITCH_CLIENT_ID,
        accessToken: twitchAccessToken,
    });

    // Faz uma nova requisição para obter o profileImageUrl
    const userResult = await apiClient.getUsers({ id: user_id });
    if (!userResult.isOk() || userResult.value.data.length === 0) {
        throw new Error("Erro ao obter dados do usuário");
    }

    const user = userResult.value.data[0];
    return {
        id: user.id,
        login: user.login,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url,
        expiresIn: expires_in,
        broadcasterType: user.broadcaster_type,
        scopes: scope ?? [],
    };
}

export function useTwitchApi() {
    const { twitchAccessToken, setSessionExpired } = useLoginStore();
    const queryClient = useQueryClient();

    // Query para obter dados do usuário Twitch
    const {
        data: userData,
        isLoading,
        isError,
        error,
        isSuccess
    } = useQuery({
        queryKey: ['twitchUser', twitchAccessToken],
        queryFn: () => fetchTwitchUserData(twitchAccessToken!),
        enabled: !!twitchAccessToken, // Só roda se tiver token
        staleTime: 10 * 60 * 1000, // 10 minutos
        gcTime: 15 * 60 * 1000, // 15 minutos
        retry: (failureCount, error) => {
            // Não tenta novamente se for erro de token inválido
            if (error instanceof Error && 
                (error.message.includes("Token inválido") || 
                 error.message.includes("não pertence ao cliente"))) {
                return false;
            }
            return failureCount < 2;
        },
        refetchInterval: 30 * 60 * 1000, // Revalida a cada 30 minutos
    });

    useEffect(() => {
        if (isError && error instanceof Error) {
            if (error.message.includes("Token inválido") || 
                error.message.includes("não pertence ao cliente")) {
                setSessionExpired(true);
            }
        }
    }, [isError, error, setSessionExpired]);

    // Função para criar cliente da API (memo baseado no token)
    const getTwitchApiClient = (): TwitchApiClient | null => {
        if (!twitchAccessToken || !isSuccess) {
            return null;
        }
        
        return makeTwitchApiClient({
            clientId: import.meta.env.VITE_TWITCH_CLIENT_ID,
            accessToken: twitchAccessToken,
        });
    };

    const twitchApiClient = getTwitchApiClient();

    // Função para invalidar cache quando necessário
    const invalidateUserData = () => {
        queryClient.invalidateQueries({ queryKey: ['twitchUser'] });
    };

    const getUserByLogin = async (userName: string) => {
        if (!twitchApiClient) {
            console.error("Twitch API client not initialized.");
            return err("Twitch API client not initialized.");
        }
        return twitchApiClient.getUsers({ login: userName });
    };

    return { 
        twitchApiClient, 
        isTokenValid: isSuccess && !isError, 
        userData: userData || null, 
        getUserByLogin,
        isLoading,
        isError,
        error,
        invalidateUserData
    };
}
