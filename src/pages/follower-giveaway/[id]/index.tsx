import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSubscriptionGiveawayDb } from "@/database";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import type { BroadcasterSubscriber } from "@/service/twitch/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { TableVirtuoso } from "react-virtuoso";

export function FollowerGiveawayId() {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { twitchApiClient, userData } = useTwitchApi();
    const [users, setUsers] = useState<BroadcasterSubscriber[] | null>(null);
    const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
    const { getGiveaway } = useSubscriptionGiveawayDb();
    const [giveaway, setGiveaway] = useState<any>(null);

    useEffect(() => {
        const fetchGiveaway = async () => {
            if (!id) {
                return;
            }
            const giveawayData = await getGiveaway(id);
            if (giveawayData) {
                setGiveaway(giveawayData);
            }
        };
        fetchGiveaway();
    }, [id, getGiveaway]);

    const onClickSearchParticipants = async () => {
        if (!twitchApiClient || !userData) {
            return;
        }

        setIsLoadingUsers(true);
        const subscriptions: BroadcasterSubscriber[] = [];

        const tiers = ["1000", "2000", "3000"] as const;
        for (let i = 0; i < 10000; i++) {
            const randomTier = tiers[Math.floor(Math.random() * tiers.length)];
            const fakeSubscription: BroadcasterSubscriber = {
                user_id: `user_${i}`,
                user_name: `user_${i}`,
                tier: randomTier,
                is_gift: false,
                broadcaster_id: userData.id,
                broadcaster_name: userData.login,
                broadcaster_login: userData.login,
                gifter_id: "",
                gifter_login: "",
                plan_name: "",
                user_login: `user_${i}`,
            };
            subscriptions.push(fakeSubscription);
        }
        setUsers(subscriptions);
        setIsLoadingUsers(false);
        // let nextPage = undefined;
        // do {
        //     const response = await twitchApiClient.getBroadcasterSubscriptions({
        //         broadcaster_id: userData?.id,
        //         first: "100",
        //         after: nextPage,
        //     });
        //     if (response.isErr()) {
        //         console.error("Error fetching subscriptions:", response.error);
        //         return;
        //     } else {
        //         subscriptions.push(...response.value.data);
        //         nextPage = response.value.pagination.cursor;
        //     }
        // } while (nextPage);
        // setIsLoadingUsers(false);
        // setUsers(subscriptions);
    };

    return (
        <Layout>
            <h1 className="text-2xl font-bold mb-4">
                {giveaway === null ? <Skeleton className="w-1/2 h-8 rounded-md" /> : giveaway.title}
            </h1>
            <div className="flex flex-row gap-8 w-full">
                <div className="flex flex-col gap-2 flex-1/3">
                    <h2 className="text-lg font-bold">{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_TITLE")}</h2>
                    {isLoadingUsers ? (
                        <Skeleton className="w-full h-full rounded-md" />
                    ) : (
                        <>
                            {(users === null || users.length === 0) && (
                                <div className="flex flex-col h-full">
                                    <p>{t("FOLLOWER_GIVEAWAY_FORM_NO_PARTICIPANTS")}</p>
                                </div>
                            )}
                            {users && users.length > 0 && (
                                <div className="flex flex-col h-full">
                                    <TableVirtuoso
                                        style={{ height: "100%" }}
                                        data={users}
                                        components={{
                                            Table,
                                            TableBody,
                                            TableRow,
                                            TableHead: TableHeader,
                                        }}
                                        fixedHeaderContent={() => (
                                            <TableRow>
                                                <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_TABLE_HEADER")}</TableHead>
                                                <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_SUBSCRIPTION_TIER_TABLE_HEADER")}</TableHead>
                                            </TableRow>
                                        )}
                                        itemContent={(_index, user) => [
                                            <TableCell>{user.user_name}</TableCell>,
                                            <TableCell>{user.tier}</TableCell>
                                        ]}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}
