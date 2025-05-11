import axios, { AxiosError } from "axios";
import { ok, err, Result } from "neverthrow";
import type { GetTwitchBroadcasterSubscriptionsParams, GetTwitchBroadcasterSubscriptionsResponse, GetTwitchUsersParams, GetTwitchUsersResponse } from "./types";

interface TwitchApiClientParams {
    clientId: string;
    accessToken: string;
}

export function makeTwitchApiClient(params: TwitchApiClientParams) {
    const { clientId, accessToken } = params;

    const apiClient = axios.create({
        baseURL: "https://api.twitch.tv/helix",
        headers: {
            "Client-ID": clientId,
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });

    return {
        getBroadcasterSubscriptions: async (params: GetTwitchBroadcasterSubscriptionsParams): Promise<Result<GetTwitchBroadcasterSubscriptionsResponse, AxiosError>> => {
            try {
                const response = await apiClient.get<GetTwitchBroadcasterSubscriptionsResponse>("/subscriptions", {
                    params: {
                        ...params,
                        first: params.first ?? "100",
                    },
                });
                return ok(response.data);
            } catch (error) {
                return err(error as AxiosError);
            }
        },
        getUsers: async (params: GetTwitchUsersParams): Promise<Result<GetTwitchUsersResponse, AxiosError>> => {
            try {
                const response = await apiClient.get<GetTwitchUsersResponse>("/users", {
                    params: {
                        ...params,
                    },
                });
                return ok(response.data);
            } catch (error) {
                return err(error as AxiosError);
            }
        }
    };
}
