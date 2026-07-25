import axios, { AxiosError } from "axios";
import { ok, err, Result } from "neverthrow";
import type {
    CreateTwitchCustomRewardParams,
    DeleteTwitchCustomRewardParams,
    GetTwitchBroadcasterSubscriptionsParams,
    GetTwitchBroadcasterSubscriptionsResponse,
    GetTwitchCustomRewardRedemptionsParams,
    GetTwitchCustomRewardRedemptionsResponse,
    GetTwitchUsersParams,
    GetTwitchUsersResponse,
    SendTwitchChatMessageParams,
    SendTwitchChatMessageResponse,
    TwitchCustomRewardResponse,
    TwitchUser,
    UpdateTwitchCustomRewardParams,
    UpdateTwitchRedemptionsStatusParams,
    UpdateTwitchRedemptionsStatusResponse,
} from "./types";
import { getTwitchHelixBaseUrl } from "@/lib/twitch-oauth";

interface TwitchApiClientParams {
    clientId: string;
    accessToken: string;
}

export function makeTwitchApiClient(params: TwitchApiClientParams) {
    const { clientId, accessToken } = params;

    const apiClient = axios.create({
        baseURL: getTwitchHelixBaseUrl(),
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
        },
        fetchUsersByIds: async (
            userIds: string[]
        ): Promise<Result<Map<string, TwitchUser>, AxiosError>> => {
            try {
                const params = new URLSearchParams();
                userIds.forEach(id => params.append('id', id));

                const response = await apiClient.get<GetTwitchUsersResponse>(`/users?${params.toString()}`);

                const userMap = new Map<string, TwitchUser>();
                response.data.data.forEach(user => {
                    userMap.set(user.id, user);
                });

                return ok(userMap);
            } catch (error) {
                return err(error as AxiosError);
            }
        },
        sendChatMessage: async (params: SendTwitchChatMessageParams): Promise<Result<SendTwitchChatMessageResponse, AxiosError>> => {
            try {
                const response = await apiClient.post<SendTwitchChatMessageResponse>("/chat/messages", {
                    broadcaster_id: params.broadcaster_id,
                    sender_id: params.sender_id,
                    message: params.message,
                    reply_parent_message_id: params.reply_parent_message_id,
                });
                return ok(response.data);
            } catch (error) {
                return err(error as AxiosError);
            }
        },
        createCustomReward: async (
            params: CreateTwitchCustomRewardParams
        ): Promise<Result<TwitchCustomRewardResponse, AxiosError>> => {
            try {
                const { broadcaster_id, ...body } = params;
                const response = await apiClient.post<TwitchCustomRewardResponse>(
                    "/channel_points/custom_rewards",
                    body,
                    { params: { broadcaster_id } }
                );
                return ok(response.data);
            } catch (error) {
                return err(error as AxiosError);
            }
        },
        updateCustomReward: async (
            params: UpdateTwitchCustomRewardParams
        ): Promise<Result<TwitchCustomRewardResponse, AxiosError>> => {
            try {
                const { broadcaster_id, id, ...body } = params;
                const response = await apiClient.patch<TwitchCustomRewardResponse>(
                    "/channel_points/custom_rewards",
                    body,
                    { params: { broadcaster_id, id } }
                );
                return ok(response.data);
            } catch (error) {
                return err(error as AxiosError);
            }
        },
        getCustomRewardRedemptions: async (
            params: GetTwitchCustomRewardRedemptionsParams
        ): Promise<Result<GetTwitchCustomRewardRedemptionsResponse, AxiosError>> => {
            try {
                const response = await apiClient.get<GetTwitchCustomRewardRedemptionsResponse>(
                    "/channel_points/custom_rewards/redemptions",
                    {
                        params: {
                            broadcaster_id: params.broadcaster_id,
                            reward_id: params.reward_id,
                            status: params.status,
                            id: params.id,
                            sort: params.sort,
                            after: params.after,
                            first: params.first ?? 50,
                        },
                    }
                );
                return ok(response.data);
            } catch (error) {
                return err(error as AxiosError);
            }
        },
        updateRedemptionsStatus: async (
            params: UpdateTwitchRedemptionsStatusParams
        ): Promise<Result<UpdateTwitchRedemptionsStatusResponse, AxiosError>> => {
            try {
                const searchParams = new URLSearchParams();
                searchParams.append("broadcaster_id", params.broadcaster_id);
                searchParams.append("reward_id", params.reward_id);
                params.ids.forEach((id) => searchParams.append("id", id));

                const response = await apiClient.patch<UpdateTwitchRedemptionsStatusResponse>(
                    `/channel_points/custom_rewards/redemptions?${searchParams.toString()}`,
                    { status: params.status }
                );
                return ok(response.data);
            } catch (error) {
                return err(error as AxiosError);
            }
        },
        deleteCustomReward: async (
            params: DeleteTwitchCustomRewardParams
        ): Promise<Result<void, AxiosError>> => {
            try {
                await apiClient.delete("/channel_points/custom_rewards", {
                    params: {
                        broadcaster_id: params.broadcaster_id,
                        id: params.id,
                    },
                });
                return ok(undefined);
            } catch (error) {
                return err(error as AxiosError);
            }
        },
    };
}
