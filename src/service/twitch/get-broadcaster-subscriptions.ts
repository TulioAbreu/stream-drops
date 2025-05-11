import { AxiosError, type AxiosInstance } from "axios";
import { err, ok, Result } from "neverthrow";
import type { TwitchPagination, TwitchSubscriptionTier } from "./types";

export type GetBroadcasterSubscriptionsParams = {
    broadcaster_id: string;
    user_id?: string;
    first?: string;
    after?: string;
    before?: string;
}

export type GetBroadcasterSubscriptionsResponse = TwitchPagination<{
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
    params: GetBroadcasterSubscriptionsParams
): Promise<Result<GetBroadcasterSubscriptionsResponse, Error>> {
    try {
        const response = await client.get<GetBroadcasterSubscriptionsResponse>("/subscriptions", {
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
