import { AxiosError, type AxiosInstance } from "axios";
import { err, ok, Result } from "neverthrow";
import type { TwitchPagination, TwitchSubscriptionTier } from "./types";

export type GetTwitchBroadcasterSubscriptionsParams = {
    broadcaster_id: string;
    user_id?: string;
    first?: string;
    after?: string;
    before?: string;
}

export type GetTwitchBroadcasterSubscriptionsResponse = TwitchPagination<{
    broadcaster_id: string;
    broadcaster_login: string;
    broadcaster_name: string;
    gifter_id: string | "";
    gifter_login: string | "";
    is_gift: boolean;
    plan_name: string;
    tier: TwitchSubscriptionTier;
    user_id: string;
    user_name: string;
    user_login: string;
}>;

export async function getBroadcasterSubscriptions(
    client: AxiosInstance,
    params: GetTwitchBroadcasterSubscriptionsParams
): Promise<Result<GetTwitchBroadcasterSubscriptionsResponse, Error>> {
    try {
        const response = await client.get<GetTwitchBroadcasterSubscriptionsResponse>("/subscriptions", {
            params: {
                ...params,
                first: params.first ?? "100",
            },
        });
        return ok(response.data);
    } catch (error) {
        return err(error as AxiosError);
    }
}
