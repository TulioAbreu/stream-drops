import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SubscriberTier, SubscriberTierLabels } from "@/domain/SubscriberTier";
import { useForm } from "react-hook-form";
import { type ChatGiveawayForm } from "../types";
import { Button } from "@/components/ui/button";
import { v7 } from "uuid";
import { useChatGiveawayDb } from "@/database/ChatGiveaway";
import { Layout } from "@/components/layout";
import { useNavigate } from "react-router";
import type { TwitchSubscriptionTier } from "@/service/twitch/types";

const FIELD_CONTAINER = "flex flex-col gap-2";

const tierOptions: Array<{ value: TwitchSubscriptionTier | "free"; label: string }> = [
    { value: "free", label: "Free (Sem inscrição)" },
    { value: "1000", label: "Tier 1" },
    { value: "2000", label: "Tier 2" },
    { value: "3000", label: "Tier 3" },
];

export function ChatGiveawayCreate() {
    const { addChatGiveaway } = useChatGiveawayDb();
    const navigate = useNavigate();
    const form = useForm<ChatGiveawayForm>({
        defaultValues: {
            title: "",
            description: "",
            keyword: "",
            cost: 0,
            minimumTier: "free",
            subscriberMultiplier: {
                "1000": 1,
                "2000": 1,
                "3000": 1,
            },
        },
    });

    const minimumTier = form.watch("minimumTier");

    const onClickSubmit = async (data: ChatGiveawayForm) => {
        try {
            const id = v7();
            const now = new Date().toISOString();
            await addChatGiveaway({
                id,
                title: data.title,
                description: data.description,
                keyword: data.keyword,
                cost: data.cost,
                minimumTier: data.minimumTier,
                subscriberMultiplier: data.subscriberMultiplier,
                winners: [],
                createdAt: now,
                updatedAt: now,
            });
            navigate(`/dashboard/chat-giveaway/${id}`);
        } catch (error) {
            console.error("Error adding chat giveaway:", error);
        }
    };

    // Get available tiers based on minimum tier
    const getAvailableTiers = () => {
        const tierOrder = ["free", "1000", "2000", "3000"];
        const minIndex = tierOrder.indexOf(minimumTier);
        return tierOrder.slice(minIndex).filter(tier => tier !== "free");
    };

    return (
        <Layout>
            <h1 className="text-2xl font-bold mb-6">Criar Chat Giveaway</h1>
            <Form {...form}>
                <div className="flex flex-col gap-4">
                    <div className={FIELD_CONTAINER}>
                        <Label>Título</Label>
                        <Input
                            placeholder="Título do sorteio"
                            {...form.register("title", {
                                required: "Título é obrigatório",
                            })}
                        />
                    </div>

                    <div className={FIELD_CONTAINER}>
                        <Label>Descrição (opcional)</Label>
                        <Textarea
                            placeholder="Descrição do sorteio"
                            className="resize-none"
                            {...form.register("description")}
                        />
                    </div>

                    <div className={FIELD_CONTAINER}>
                        <Label>Palavra-chave</Label>
                        <Input
                            placeholder="!sorteio"
                            {...form.register("keyword", {
                                required: "Palavra-chave é obrigatória",
                            })}
                        />
                    </div>

                    <div className={FIELD_CONTAINER}>
                        <Label>Custo (pontos do canal)</Label>
                        <Input
                            type="number"
                            placeholder="0"
                            {...form.register("cost", {
                                valueAsNumber: true,
                            })}
                        />
                    </div>

                    <div className={FIELD_CONTAINER}>
                        <Label>Tier mínimo para participar</Label>
                        <FormField
                            control={form.control}
                            name="minimumTier"
                            render={({ field }) => (
                                <Select
                                    value={field.value}
                                    onValueChange={(value) => {
                                        field.onChange(value);
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tierOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    {minimumTier !== "free" && (
                        <div className={FIELD_CONTAINER}>
                            <Label>Sorte de Subscriber</Label>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tier</TableHead>
                                        <TableHead>Multiplicador de Sorte</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {getAvailableTiers().map((tierValue) => (
                                        <TableRow key={tierValue}>
                                            <TableCell>
                                                {SubscriberTierLabels[tierValue as unknown as typeof SubscriberTier[keyof typeof SubscriberTier]]}
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    placeholder="1"
                                                    className="w-[100px]"
                                                    {...form.register(`subscriberMultiplier.${tierValue}` as `subscriberMultiplier.${TwitchSubscriptionTier}`, {
                                                        valueAsNumber: true,
                                                    })}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <div className="flex flex-row items-center justify-end">
                        <Button type="submit" onClick={form.handleSubmit(onClickSubmit)}>
                            Criar Sorteio
                        </Button>
                    </div>
                </div>
            </Form>
        </Layout>
    );
}
