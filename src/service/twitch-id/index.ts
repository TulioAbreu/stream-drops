import axios, { AxiosError } from "axios";
import { err, ok, type Result } from "neverthrow";

interface TwitchIdValidateTokenResponse {
    client_id: string;
    login: string;
    scope: string[];
    token_type: string;
    expires_in: number;
    user_id: string;
    user_name: string;
}

export function makeTwitchIdApiClient() {
    const apiClient = axios.create({
        baseURL: "https://id.twitch.tv/oauth2",
        headers: {
            "Content-Type": "application/json",
        },
    });

    return {
        validateToken: async (accessToken: string): Promise<Result<TwitchIdValidateTokenResponse, Error>> => {
            try {
                const response = await apiClient.get<TwitchIdValidateTokenResponse>("/validate", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
                return ok(response.data);
            } catch (error) {
                return err(error as AxiosError);
            }
        }
    };
}
