import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChatGiveawayDb } from "@/database/ChatGiveaway";
import { useEffect, useState } from "react";
import type { ChatGiveawayFormData } from "@/database/ChatGiveaway";
import { useNavigate } from "react-router";
import { Plus, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ChatGiveaway() {
    const navigate = useNavigate();
    const { getChatGiveaways } = useChatGiveawayDb();
    const [giveaways, setGiveaways] = useState<ChatGiveawayFormData[]>([]);

    useEffect(() => {
        const loadGiveaways = async () => {
            const data = await getChatGiveaways();
            setGiveaways(data);
        };
        loadGiveaways();
    }, [getChatGiveaways]);

    const tierLabels: Record<string, string> = {
        "free": "Free",
        "1000": "Tier 1",
        "2000": "Tier 2",
        "3000": "Tier 3",
    };

    return (
        <Layout>
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Chat Giveaways</h1>
                        <p className="text-muted-foreground">
                            Gerencie seus sorteios baseados em chat
                        </p>
                    </div>
                    <Button onClick={() => navigate("/dashboard/chat-giveaway/create")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Sorteio
                    </Button>
                </div>

                {giveaways.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Nenhum sorteio ainda</h3>
                            <p className="text-muted-foreground mb-4">
                                Crie seu primeiro chat giveaway para começar
                            </p>
                            <Button onClick={() => navigate("/dashboard/chat-giveaway/create")}>
                                <Plus className="h-4 w-4 mr-2" />
                                Criar Sorteio
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {giveaways.map((giveaway) => (
                            <Card
                                key={giveaway.id}
                                className="cursor-pointer hover:bg-accent transition-colors"
                                onClick={() => navigate(`/dashboard/chat-giveaway/${giveaway.id}`)}
                            >
                                <CardHeader>
                                    <CardTitle>{giveaway.title}</CardTitle>
                                    <CardDescription>
                                        {giveaway.description || "Sem descrição"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2 flex-wrap">
                                            <Badge variant="outline">
                                                {giveaway.keyword}
                                            </Badge>
                                            <Badge variant="outline">
                                                {tierLabels[giveaway.minimumTier]}
                                            </Badge>
                                            {giveaway.cost > 0 && (
                                                <Badge variant="outline">
                                                    {giveaway.cost} pontos
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-2">
                                            <div className="flex items-center gap-2">
                                                <Trophy className="h-4 w-4" />
                                                <span>{giveaway.winners.length} vencedor(es)</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
