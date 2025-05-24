import type { TwitchApiClient } from "@/hooks/use-twitch-api";
import type { BroadcasterSubscriber } from "@/service/twitch/types";

export async function fetchSubscribers(
    twitchApiClient: TwitchApiClient,
    broadcasterId: string,
    progressCallback: (progress: number) => void,
): Promise<BroadcasterSubscriber[]> {
    const subscriptions: BroadcasterSubscriber[] = [];
    let nextPage: string | undefined = undefined;
    let totalPages = 0;
    let currentPage = 0;
    do {
        const response = await twitchApiClient.getBroadcasterSubscriptions({
            broadcaster_id: broadcasterId,
            first: "100",
            after: nextPage,
        });
        if (response.isErr()) {
            throw new Error("Ocorreu um erro ao buscar os inscritos");
        } else {
            const { total, data, pagination } = response.value;

            totalPages = Math.ceil(total / 100);
            currentPage++;
            subscriptions.push(...data);
            nextPage = pagination.cursor;
            progressCallback((currentPage / totalPages));
        }
    } while (nextPage);
    return subscriptions;
}