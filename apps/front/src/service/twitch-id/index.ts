import axios, { AxiosError } from "axios";
import { err, ok, type Result } from "neverthrow";
import type { TwitchIdValidateTokenResponse } from "./types";
import { getTwitchIdBaseUrl } from "@/lib/twitch-oauth";

export function makeTwitchIdApiClient() {
    const apiClient = axios.create({
        baseURL: getTwitchIdBaseUrl(),
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
