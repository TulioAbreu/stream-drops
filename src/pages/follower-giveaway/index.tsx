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

interface FollowerGiveawayForm {
    title: string;
    description: string;
    requiredSubscriber: SubscriberTier;
    subscriberMultiplier: Record<SubscriberTier, number>;
}

export function FollowerGiveaway() {
    const { t } = useTranslation();
    const { twitchApiClient, userData } = useTwitchApi();
    const [users, setUsers] = useState<BroadcasterSubscriber[] | null>(null);
    const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

    const form = useForm<FollowerGiveawayForm>({
        defaultValues: {
            title: "",
            description: "",
            requiredSubscriber: SubscriberTier.TIER_1,
            subscriberMultiplier: {
                [SubscriberTier.TIER_1]: 1,
                [SubscriberTier.TIER_2]: 1,
                [SubscriberTier.TIER_3]: 1,
            },
        },
    });

    const requiredSubscriber = form.watch("requiredSubscriber");

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
                    <div className="flex flex-row justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">{t("FOLLOWER_GIVEAWAY_TITLE")}</h1>
                            <p className="text-sm text-muted-foreground">{t("FOLLOWER_GIVEAWAY_DESCRIPTION")}</p>
                        </div>
                        <div className="flex flex-row gap-4">
                            <Button type="button" onClick={onClickSearchParticipants}>{t("FOLLOWER_GIVEAWAY_FORM_FIND_PARTICIPANTS_BUTTON")}</Button>
                            <Button
                                variant="default"
                                onClick={() => {}}
                                className="min-w-[160px]"
                                disabled={isLoadingUsers || users === null || users.length === 0}
                            >
                                Sortear
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-row gap-8 w-full">
                        <div className="flex-1/3">
                            <Form {...form}>
                                <form className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-2">
                                        <Label>{t("FOLLOWER_GIVEAWAY_FORM_TITLE_FIELD")}</Label>
                                        <Input placeholder={t("FOLLOWER_GIVEAWAY_FORM_TITLE_FIELD")} />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label>{t("FOLLOWER_GIVEAWAY_FORM_DESCRIPTION_FIELD")}</Label>
                                        <Textarea placeholder={t("FOLLOWER_GIVEAWAY_FORM_DESCRIPTION_FIELD")} className="resize-none" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label>{t("FOLLOWER_GIVEAWAY_FORM_SUBSCRIPTION_REQUIREMENT_FIELD")}</Label>
                                        <FormField
                                            control={form.control}
                                            name="requiredSubscriber"
                                            render={({ field }) => (
                                                <Select
                                                    onValueChange={(value) => {
                                                        field.onChange(value);
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Selecione" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Object.values(SubscriberTier).map((tierValue) => (
                                                            <SelectItem key={tierValue} value={String(tierValue)}>
                                                                {SubscriberTierLabels[tierValue]}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label>{t("FOLLOWER_GIVEAWAY_FORM_SUBSCRIBER_LUCK")}</Label>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_SUBSCRIPTION_TIER_TABLE_HEADER")}</TableHead>
                                                    <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_SUBSCRIPTION_SUBSCRIBER_LUCK_TABLE_HEADER")}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            {Object.values(SubscriberTier).filter((tier) => tier >= requiredSubscriber).map((tierValue) => (
                                                <TableRow key={tierValue}>
                                                    <TableCell>{SubscriberTierLabels[tierValue]}</TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            placeholder="0"
                                                            className="w-[100px]"
                                                            {...form.register(`subscriberMultiplier.${tierValue}` as any)}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </Table>
                                    </div>
                                </form>
                            </Form>
                        </div>
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
