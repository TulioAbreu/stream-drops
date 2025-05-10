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
import { T } from "@/i18n";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

interface FollowerGiveawayForm {
    title: string;
    description: string;
    requiredSubscriber: SubscriberTier;
    subscriberMultiplier: Record<SubscriberTier, number>;
}

export function FollowerGiveaway() {
    const form = useForm<FollowerGiveawayForm>({
        defaultValues: {
            title: "",
            description: "",
            requiredSubscriber: SubscriberTier.FREE,
            subscriberMultiplier: {
                [SubscriberTier.FREE]: 1,
                [SubscriberTier.TIER_1]: 1,
                [SubscriberTier.TIER_2]: 1,
                [SubscriberTier.TIER_3]: 1,
            },
        },
    });

    const requiredSubscriber = form.watch("requiredSubscriber");

    return (
        <Layout>
            <div className="flex flex-col items-center justify-center flex-grow">
                <Card className="rounded w-[600px]">
                    <CardHeader>
                        <CardTitle>{T["FOLLOWER_GIVEAWAY_TITLE"]}</CardTitle>
                        <CardDescription>{T["FOLLOWER_GIVEAWAY_DESCRIPTION"]}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <Label>Título do Sorteio</Label>
                                    <Input placeholder="Título do Sorteio" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>Descrição do Sorteio</Label>
                                    <Textarea placeholder="Descrição do Sorteio" className="resize-none" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>Requerimento de Sub</Label>
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
                                    <Label>Sorte de Sub</Label>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tier</TableHead>
                                                <TableHead>Multiplicador</TableHead>
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
                        <Button>Buscar Participantes</Button>
                    </CardFooter>
                </Card>
            </div>
        </Layout>
    );
}
