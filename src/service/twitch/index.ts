import axios from "axios";
import { getBroadcasterSubscriptions, type GetBroadcasterSubscriptionsParams } from "./get-broadcaster-subscriptions";

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
        getBroadcasterSubscriptions: (params: GetBroadcasterSubscriptionsParams) => getBroadcasterSubscriptions(apiClient, params),
    };
}
