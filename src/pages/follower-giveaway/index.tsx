import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TableVirtuoso } from "react-virtuoso";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SubscriberTier, SubscriberTierLabels } from "@/domain/SubscriberTier";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import type { BroadcasterSubscriber } from "@/service/twitch/types";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FollowerGiveawayForm } from "./components/follower-giveaway-form";

export function FollowerGiveaway() {
    const { t } = useTranslation();
    const { twitchApiClient, userData } = useTwitchApi();
    const [users, setUsers] = useState<BroadcasterSubscriber[] | null>(null);
    const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);


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
            <div className="flex flex-row justify-center flex-grow gap-4">
                <div className="flex flex-col gap-4 w-full p-8">
                        <FollowerGiveawayForm
                            onSubmit={onClickSearchParticipants}
                        />
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
                </div>
            </div>
        </Layout>
    );
}
