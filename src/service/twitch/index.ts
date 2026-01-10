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
        fetchSubscriptionsByUserIds: async (
            broadcasterId: string,
            userIds: string[]
        ): Promise<Result<Map<string, number | null>, AxiosError>> => {
            try {
                // Build query string with multiple user_id parameters using URLSearchParams
                const params = new URLSearchParams();
                params.append('broadcaster_id', broadcasterId);
                userIds.forEach(id => params.append('user_id', id));
                
                const url = `/subscriptions?${params.toString()}`;

                const response = await apiClient.get<GetTwitchBroadcasterSubscriptionsResponse>(url);

                // Create a map of userId -> tier
                const tierMap = new Map<string, number | null>();

                // Add fetched subscribers to map with their tiers
                response.data.data.forEach(sub => {
                    const tierValue = Number(sub.tier);
                    tierMap.set(sub.user_id, tierValue);
                });

                // Add non-subscribers to map with null tier
                userIds.forEach(userId => {
                    if (!tierMap.has(userId)) {
                        tierMap.set(userId, null);
                    }
                });

                return ok(tierMap);
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
