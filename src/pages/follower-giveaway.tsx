import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

        let nextPage = undefined;
        do {
            const response = await twitchApiClient.getBroadcasterSubscriptions({
                broadcaster_id: userData?.id,
                first: "100",
                after: nextPage,
            });
            if (response.isErr()) {
                console.error("Error fetching subscriptions:", response.error);
                return;
            } else {
                subscriptions.push(...response.value.data);
                nextPage = response.value.pagination.cursor;
            }
        } while (nextPage);
        setIsLoadingUsers(false);
        setUsers(subscriptions);
    };

    return (
        <Layout>
            <div className="flex flex-row justify-center flex-grow gap-4">
                <div className="flex flex-col gap-4 w-full p-8 sm:flex-row">
                    <Card className="rounded w-[60%] min-w-[400px]">
                        <CardHeader>
                            <CardTitle>{t("FOLLOWER_GIVEAWAY_TITLE")}</CardTitle>
                            <CardDescription>{t("FOLLOWER_GIVEAWAY_DESCRIPTION")}</CardDescription>
                        </CardHeader>
                        <CardContent>
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
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Button onClick={onClickSearchParticipants}>{t("FOLLOWER_GIVEAWAY_FORM_FIND_PARTICIPANTS_BUTTON")}</Button>
                        </CardFooter>
                    </Card>
                    {(isLoadingUsers || users) && (
                        <Card className="rounded w-[40%] max-h-[400px] overflow-auto">
                            <CardHeader>
                                <CardTitle>{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_TITLE")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoadingUsers ? (
                                    <div>

                                    </div>
                                ) : (
                                    users && users.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full">
                                            <p>{t("FOLLOWER_GIVEAWAY_FORM_NO_PARTICIPANTS")}</p>
                                        </div>
                                    ) : (
                                        users && (
                                            <Table className="w-full">
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_TABLE_HEADER")}</TableHead>
                                                        <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_SUBSCRIPTION_TIER_TABLE_HEADER")}</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                {users.map((user) => (
                                                    <TableRow key={user.user_id}>
                                                        <TableCell>{user.user_name}</TableCell>
                                                        <TableCell>{user.tier}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </Table>
                                        )
                                    )
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </Layout>
    );
}
