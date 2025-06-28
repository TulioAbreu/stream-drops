import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/page-header/page-header";
import { PageHeaderTitle } from "@/components/page-header/page-header-title";
import { type FollowerGiveawayFormData, useSubscriptionGiveawayDb } from "@/database";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { SubscriberTier, SubscriberTierLabels } from "@/domain/SubscriberTier";
import { Form, FormField } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FIELD_CONTAINER = "flex flex-col gap-2";

export function EditFollowerGiveawayPage() {
    const { id } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const form = useForm<FollowerGiveawayFormData>();

    const { getGiveaway, updateGiveaway } = useSubscriptionGiveawayDb();

    const giveaway = form.watch();

    const onClickSubmit = async (data: FollowerGiveawayFormData) => {
        if (!id) return;
        try {
            await updateGiveaway(data);
            navigate(`/dashboard/follower-giveaway/${id}`);
        } catch (error) {
            console.error("Error updating giveaway:", error);
        }
    };

    useEffect(() => {
        if (!id) return;
        getGiveaway(id)
            .then((data) => form.reset(data))
            .catch((_error) => {
                // TODO: Handle error (e.g., show a notification)
            });
    }, [id]);

    if (!giveaway) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-screen">
                    <h1 className="text-2xl font-bold">
                        {t("FOLLOWER_GIVEAWAY_NOT_FOUND_TITLE")}
                    </h1>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <PageHeader>
                <PageHeaderTitle>{t("FOLLOWER_GIVEAWAY_EDIT_TITLE", { title: giveaway.title })}</PageHeaderTitle>
            </PageHeader>
            <Form {...form}>
                <div className="flex flex-col gap-4">
                    <div className={FIELD_CONTAINER}>
                        <Label>{t("FOLLOWER_GIVEAWAY_FORM_TITLE_FIELD")}</Label>
                        <Input
                            placeholder={t("FOLLOWER_GIVEAWAY_FORM_TITLE_FIELD")}
                            {...form.register("title", {
                                required: t("FOLLOWER_GIVEAWAY_FORM_TITLE_FIELD_REQUIRED"),
                            })}
                        />
                    </div>
                    <div className={FIELD_CONTAINER}>
                        <Label>{t("FOLLOWER_GIVEAWAY_FORM_DESCRIPTION_FIELD")}</Label>
                        <Textarea
                            placeholder={t("FOLLOWER_GIVEAWAY_FORM_DESCRIPTION_FIELD")}
                            className="resize-none"
                            {...form.register("description", {
                                required: t("FOLLOWER_GIVEAWAY_FORM_DESCRIPTION_FIELD_REQUIRED"),
                            })}
                        />
                    </div>
                    <div className={FIELD_CONTAINER}>
                        <Label>{t("FOLLOWER_GIVEAWAY_FORM_SUBSCRIPTION_REQUIREMENT_FIELD")}</Label>
                        <FormField
                            control={form.control}
                            name="subscriptionRequirement"
                            render={({ field }) => (
                                <Select
                                    value={String(field.value)}
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
                    <div className={FIELD_CONTAINER}>
                        <Label>{t("FOLLOWER_GIVEAWAY_FORM_SUBSCRIBER_LUCK")}</Label>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_SUBSCRIPTION_TIER_TABLE_HEADER")}</TableHead>
                                    <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_SUBSCRIPTION_SUBSCRIBER_LUCK_TABLE_HEADER")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            {Object.values(SubscriberTier).filter((tier) => tier >= giveaway.subscriptionRequirement).map((tierValue) => (
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
                    <div className="flex flex-row items-center justify-end">
                        <Button type="submit" onClick={form.handleSubmit(onClickSubmit)}>
                            {t("FOLLOWER_GIVEAWAY_FORM_EDIT_BUTTON")}
                        </Button>
                    </div>
                </div>
            </Form>
        </Layout>
    );
}
