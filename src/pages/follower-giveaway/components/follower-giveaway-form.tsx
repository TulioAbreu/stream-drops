import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SubscriberTier, SubscriberTierLabels } from "@/domain/SubscriberTier";
import { useForm } from "react-hook-form";
import { type FollowerGiveawayForm } from "../types";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { v7 } from "uuid";
import { useSubscriptionGiveawayDb } from "@/database";

interface FollowerGiveawayFormProps {
    onSubmit: (data: FollowerGiveawayForm) => void;
}

export function FollowerGiveawayForm({ onSubmit }: FollowerGiveawayFormProps) {
    const { t } = useTranslation();
    const { addGiveaway } = useSubscriptionGiveawayDb();
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
    
    const onClickSubmit = (data: FollowerGiveawayForm) => {
        addGiveaway({
            ...data,
            id: v7(),
            description: data.description,
            requiredSubscriber: data.requiredSubscriber,
            subscriberMultiplier: data.subscriberMultiplier,
            title: data.title,
            participants: [],
            winners: [],
        })
            .then(() => {
                onSubmit(data);
        })
            .then(() => {
                alert("Giveaway added successfully");
            })
    };

    return (
        <>
            <div className="flex flex-col">
                <h1 className="text-2xl font-bold">{t("FOLLOWER_GIVEAWAY_TITLE")}</h1>
            </div>
            <Form {...form}>
                <form className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label>{t("FOLLOWER_GIVEAWAY_FORM_TITLE_FIELD")}</Label>
                        <Input
                            placeholder={t("FOLLOWER_GIVEAWAY_FORM_TITLE_FIELD")}
                            {...form.register("title", {
                                required: t("FOLLOWER_GIVEAWAY_FORM_TITLE_FIELD_REQUIRED"),
                            })}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label>{t("FOLLOWER_GIVEAWAY_FORM_DESCRIPTION_FIELD")}</Label>
                        <Textarea
                            placeholder={t("FOLLOWER_GIVEAWAY_FORM_DESCRIPTION_FIELD")}
                            className="resize-none"
                            {...form.register("description", {
                                required: t("FOLLOWER_GIVEAWAY_FORM_DESCRIPTION_FIELD_REQUIRED"),
                            })}
                        />
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
                    <div className="flex flex-row items-center justify-end gap-2">
                        <Button type="submit" onClick={form.handleSubmit(onClickSubmit)}>
                            {t("FOLLOWER_GIVEAWAY_FORM_FIND_PARTICIPANTS_BUTTON")}
                        </Button>
                    </div>
                </form>
            </Form>
        </>
    )
}