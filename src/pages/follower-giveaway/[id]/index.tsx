import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSubscriptionGiveawayDb } from "@/database";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import type { BroadcasterSubscriber } from "@/service/twitch/types";
import { ArrowLeftIcon, PartyPopperIcon, SearchIcon, UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { TableVirtuoso } from "react-virtuoso";

export function FollowerGiveawayId() {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { twitchApiClient, userData } = useTwitchApi();
    const [users, setUsers] = useState<BroadcasterSubscriber[] | null>(null);
    const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
    const { getGiveaway } = useSubscriptionGiveawayDb();
    const [giveaway, setGiveaway] = useState<any>(null);
    const navigate = useNavigate();

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

    const onClickBack = () => {
        navigate("/dashboard/follower-giveaway");
    };

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
            <div className="flex flex-row justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{giveaway === null ? <Skeleton className="w-1/2 h-8 rounded-md" /> : giveaway.title}</h1>
                    <p className="text-muted-foreground">{giveaway?.description}</p>
                </div>
                <div className="flex flex-row gap-4">
                    <Button variant="ghost" size="lg" onClick={onClickBack}>
                        <ArrowLeftIcon className="w-4 h-4 mr-2" />
                        <span>{t("NAVIGATE_BACK")}</span>
                    </Button>
                    <Button variant="outline" onClick={onClickSearchParticipants} size="lg">
                        <SearchIcon className="w-4 h-4 mr-2" />
                        <span>{t("FOLLOWER_GIVEAWAY_FORM_SEARCH_PARTICIPANTS")}</span>
                    </Button>
                    <div className="flex flex-row gap-2">
                        <Button variant="outline" size="lg">
                            <PartyPopperIcon className="w-4 h-4 mr-2" />
                            <span>{t("FOLLOWER_GIVEAWAY_FORM_DRAW_WINNERS")}</span>
                        </Button>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-4 items-start w-1/4">
                <Card className="w-full">
                    <CardHeader className="relative">
                        <CardDescription>Total de Participantes</CardDescription>
                        <CardTitle className="text-3xl font-semibold tabular-nums">
                            <div className="flex flex-row gap-2 items-center">
                                <UserIcon className="w-6 h-6" />
                                {users?.length ?? 0}
                            </div>
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="w-full">
                    <CardHeader className="relative">
                        <CardTitle className="text-2xl font-semibold">Lista de Participantes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(users === null || users.length === 0) ? (
                            <div className="flex flex-col h-full">
                                <p>{t("FOLLOWER_GIVEAWAY_FORM_NO_PARTICIPANTS")}</p>
                            </div>
                        ) : (
                            <TableVirtuoso
                                style={{ height: "300px" }}
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
                        )}
                    </CardContent>
                </Card>
                <div className="flex flex-col gap-4 w-1/8">

                </div>
            </div>
        </Layout>
    );
}
