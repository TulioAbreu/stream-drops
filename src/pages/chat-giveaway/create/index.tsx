import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { type ChatGiveawayForm } from "../types";
import { Button } from "@/components/ui/button";
import { v7 } from "uuid";
import { useChatGiveawayDb } from "@/database/ChatGiveaway";
import { Layout } from "@/components/layout";
import { useNavigate } from "react-router";

const FIELD_CONTAINER = "flex flex-col gap-2";

export function ChatGiveawayCreate() {
    const { addChatGiveaway } = useChatGiveawayDb();
    const navigate = useNavigate();
    const form = useForm<ChatGiveawayForm>({
        defaultValues: {
            title: "",
            description: "",
            keyword: "",
            minimumSuscriptionTimeInMonths: 0,
            subscriberMultiplier: 1,
            subscribersOnly: false,
        },
    });

    const onClickSubmit = async (data: ChatGiveawayForm) => {
        try {
            const id = v7();
            const now = new Date().toISOString();
            await addChatGiveaway({
                id,
                title: data.title,
                description: data.description,
                keyword: data.keyword,
                cost: 0,
                minimumSuscriptionTimeInMonths: data.minimumSuscriptionTimeInMonths,
                subscriberMultiplier: data.subscriberMultiplier,
                subscribersOnly: data.subscribersOnly,
                winners: [],
                createdAt: now,
                updatedAt: now,
            });
            navigate(`/dashboard/chat-giveaway/${id}`);
        } catch (error) {
            console.error("Error adding chat giveaway:", error);
        }
    };

    return (
        <Layout>
            <h1 className="text-2xl font-bold mb-6">Criar Chat Giveaway</h1>
            <div className="flex flex-col gap-4">
                <div className={FIELD_CONTAINER}>
                    <Label>
                        Título
                        <span className="text-destructive ml-1">*</span>
                    </Label>
                    <Input
                        placeholder="Título do sorteio"
                        {...form.register("title", {
                            required: "Título é obrigatório",
                        })}
                    />
                </div>

                <div className={FIELD_CONTAINER}>
                    <Label>Descrição</Label>
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
                        {...form.register("keyword")}
                    />
                </div>

                <div className={FIELD_CONTAINER}>
                    <Label>Tempo mínimo de inscrição (meses)</Label>
                    <Input
                        type="number"
                        placeholder="0"
                        {...form.register("minimumSuscriptionTimeInMonths", {
                            valueAsNumber: true,
                            min: 0,
                        })}
                    />
                </div>

                <div className={FIELD_CONTAINER}>
                    <Label>Multiplicador de Sorte para Subscribers</Label>
                    <Input
                        type="number"
                        placeholder="1"
                        {...form.register("subscriberMultiplier", {
                            valueAsNumber: true,
                            min: 1,
                        })}
                    />
                    <p className="text-sm text-muted-foreground">
                        Subscribers terão este multiplicador aplicado às suas chances de ganhar (padrão: 1)
                    </p>
                </div>

                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="subscribersOnly"
                        checked={form.watch("subscribersOnly")}
                        onCheckedChange={(checked) => form.setValue("subscribersOnly", checked as boolean)}
                    />
                    <Label htmlFor="subscribersOnly" className="cursor-pointer">
                        Apenas subscribers podem participar
                    </Label>
                </div>

                <div className="flex flex-row items-center justify-end">
                    <Button type="submit" onClick={form.handleSubmit(onClickSubmit)}>
                        Criar Sorteio
                    </Button>
                </div>
            </div>
        </Layout>
    );
}
