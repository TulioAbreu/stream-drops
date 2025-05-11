import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SubscriberTier, SubscriberTierLabels } from "@/domain/SubscriberTier";
import { useTranslation } from "@/i18n";
import { useForm } from "react-hook-form";

interface FollowerGiveawayForm {
    title: string;
    description: string;
    requiredSubscriber: SubscriberTier;
    subscriberMultiplier: Record<SubscriberTier, number>;
}

export function FollowerGiveaway() {
    const { t } = useTranslation();
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

    const onClickSearchParticipants = () => {

    };

    return (
        <Layout>
            <div className="flex flex-row items-center justify-center flex-grow gap-4">
                <div className="flex flex-row gap-4">
                    <Card className="rounded w-[600px]">
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
                            <Button>{t("FOLLOWER_GIVEAWAY_FORM_FIND_PARTICIPANTS_BUTTON")}</Button>
                        </CardFooter>
                    </Card>
                    <Card className="rounded w-[400px]">
                    </Card>
                </div>
            </div>
        </Layout>
    );
}
