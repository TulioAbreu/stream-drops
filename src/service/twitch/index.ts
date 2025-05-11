import axios from "axios";
import { getBroadcasterSubscriptions, type GetTwitchBroadcasterSubscriptionsParams } from "./get-broadcaster-subscriptions";
import { getTwitchUsers, type GetTwitchUsersParams } from "./get-users";

interface TwitchApiClientParams {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    accessToken: string;
}

export function makeTwitchApiClient(params: TwitchApiClientParams) {
    const { clientId, clientSecret, redirectUri, accessToken } = params;

    const apiClient = axios.create({
        baseURL: "https://api.twitch.tv/helix",
        headers: {
            "Client-ID": clientId,
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });

    return {
        getBroadcasterSubscriptions: (params: GetTwitchBroadcasterSubscriptionsParams) => getBroadcasterSubscriptions(apiClient, params),
        getUsers: (params: GetTwitchUsersParams) => getTwitchUsers(apiClient, params)
    };
}
