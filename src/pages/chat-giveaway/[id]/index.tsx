import { Layout } from "@/components/layout";
import { useParams, useNavigate } from "react-router";
import { useChatGiveawayDb, type ChatGiveawayWinner } from "@/database/ChatGiveaway";
import { useEffect, useState } from "react";
import type { ChatGiveawayFormData } from "@/database/ChatGiveaway";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Trophy, Sparkles } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { useChatListener } from "../hooks/use-chat-listener";
import { drawWinner } from "@/service/chat-giveaway";
import { toast } from "sonner";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { composeTwitchChatEmbedUrl } from "@/lib/utils";
import { SubscriptionTierWithFree } from "@/service/twitch/types";

export function ChatGiveawayDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { getChatGiveaway, updateChatGiveaway } = useChatGiveawayDb();
    const { userData } = useTwitchApi();
    const [giveaway, setGiveaway] = useState<ChatGiveawayFormData | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Use chat listener when we have user data and giveaway data
    const {
        participants,
        allParticipants,
        isConnected,
        connectionStatus,
        error: chatError,
        reconnect,
        filterParticipants,
        nameFilter
    } = useChatListener({
        channel: userData?.login || "",
        keyword: giveaway?.keyword || "",
        minimumTier: giveaway?.minimumTier || "free",
    });

    useEffect(() => {
        if (!id) return;

        const loadGiveaway = async () => {
            const data = await getChatGiveaway(id);
            if (!data) {
                navigate("/dashboard");
                return;
            }
            setGiveaway(data);
        };

        loadGiveaway();
    }, [id, getChatGiveaway, navigate]);

    const handleDraw = async () => {
        if (!giveaway || participants.length === 0) {
            toast.error("Não há participantes elegíveis para sortear!");
            return;
        }

        setIsDrawing(true);

        // Simulate drawing animation delay
        setTimeout(async () => {
            const excludeIds = giveaway.winners.map(w => w.twitchId);
            const winner = drawWinner({
                participants,
                subscriberMultiplier: giveaway.subscriberMultiplier,
                excludeIds,
            });

            if (!winner) {
                toast.error("Todos os participantes já foram sorteados!");
                setIsDrawing(false);
                return;
            }

            const newWinner: ChatGiveawayWinner = {
                id: winner.id,
                name: winner.displayName,
                twitchId: winner.id,
                avatar: winner.avatar,
                drawnAt: new Date().toISOString(),
            };

            const updatedGiveaway = {
                ...giveaway,
                winners: [...giveaway.winners, newWinner],
                updatedAt: new Date().toISOString(),
            };

            await updateChatGiveaway(updatedGiveaway);
            setGiveaway(updatedGiveaway);

            toast.success(`🎉 ${winner.displayName} foi sorteado(a)!`);
            setIsDrawing(false);
        }, 1500);
    };

    if (!giveaway) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-full">
                    <p>Carregando...</p>
                </div>
            </Layout>
        );
    }

    const tierLabels: Record<string, string> = {
        [SubscriptionTierWithFree.FREE]: "Free",
        [SubscriptionTierWithFree.TIER_1]: "Tier 1",
        [SubscriptionTierWithFree.TIER_2]: "Tier 2",
        [SubscriptionTierWithFree.TIER_3]: "Tier 3",
    };

    return (
        <Layout>
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">{giveaway.title}</h1>
                        {giveaway.description && (
                            <p className="text-muted-foreground">{giveaway.description}</p>
                        )}
                        <div className="flex gap-2 mt-3">
                            <Badge variant="outline">Palavra-chave: {giveaway.keyword}</Badge>
                            <Badge variant="outline">Tier mínimo: {tierLabels[giveaway.minimumTier]}</Badge>
                        </div>
                    </div>
                    <Button
                        onClick={handleDraw}
                        disabled={isDrawing || participants.length === 0}
                        size="lg"
                        className="gap-2"
                    >
                        {isDrawing ? (
                            <>
                                <Sparkles className="h-5 w-5 animate-spin" />
                                Sorteando...
                            </>
                        ) : (
                            <>
                                <Trophy className="h-5 w-5" />
                                Sortear Vencedor
                            </>
                        )}
                    </Button>
                </div>

                {/* Three columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Participants Column */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Participantes
                                {connectionStatus === "connected" && (
                                    <Badge variant="secondary" className="text-xs">
                                        Conectado
                                    </Badge>
                                )}
                                {connectionStatus === "connecting" && (
                                    <Badge variant="outline" className="text-xs">
                                        Conectando...
                                    </Badge>
                                )}
                                {connectionStatus === "error" && (
                                    <Badge variant="destructive" className="text-xs">
                                        Erro
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription>
                                {nameFilter.trim() ? (
                                    <>
                                        {participants.length} participantes encontrados
                                        <span className="text-muted-foreground">
                                            {" "}(de {allParticipants.length} total)
                                        </span>
                                    </>
                                ) : (
                                    <>{participants.length} participantes elegíveis</>
                                )}
                                {chatError && (
                                    <p className="text-destructive text-sm mt-1">
                                        Erro no chat: {chatError}
                                    </p>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <Input
                                    placeholder="Filtrar por nome..."
                                    value={nameFilter}
                                    onChange={(e) => filterParticipants(e.target.value)}
                                    className="h-8"
                                />
                            </div>
                            <ScrollArea className="h-[460px] pr-4 mt-3">
                                <div className="space-y-3">
                                    {participants.map((participant) => (
                                        <div
                                            key={participant.id}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent"
                                        >
                                            <Avatar>
                                                <AvatarImage src={participant.avatar} />
                                                <AvatarFallback>
                                                    {participant.displayName[0].toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">
                                                    {participant.displayName}
                                                </p>
                                                <Badge variant="secondary" className="text-xs">
                                                    {tierLabels[participant.tier]}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Chat Column */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Chat da Twitch
                                {isConnected && (
                                    <Badge variant="secondary" className="text-xs">
                                        Ao vivo
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription>
                                {userData?.login ? `Canal: ${userData.login}` : "Carregando canal..."}
                                {!isConnected && userData?.login && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-sm text-muted-foreground">
                                            Status: {connectionStatus}
                                        </span>
                                        {connectionStatus === "error" && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={reconnect}
                                                className="h-6 px-2 text-xs"
                                            >
                                                Reconectar
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {userData?.login ? (
                                <iframe
                                    src={composeTwitchChatEmbedUrl(userData.login)}
                                    className="w-full h-[500px] border-0 rounded-lg"
                                    title={`Chat do canal ${userData.login}`}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[500px] bg-muted rounded-lg p-6">
                                    <AlertCircle className="h-8 w-8 text-destructive mb-3" />
                                    <p className="text-center text-destructive font-medium">
                                        Não foi possível montar o chat: dados do usuário ausentes.
                                    </p>
                                    <p className="text-center text-sm text-muted-foreground mt-2">
                                        Verifique se você está autenticado com a conta Twitch correta.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Winners Column */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Vencedores</CardTitle>
                            <CardDescription>
                                {giveaway.winners.length} vencedor(es)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px] pr-4">
                                <div className="space-y-3">
                                    {giveaway.winners.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-8">
                                            Nenhum vencedor ainda
                                        </p>
                                    ) : (
                                        giveaway.winners.map((winner, index) => (
                                            <div
                                                key={winner.id}
                                                className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20"
                                            >
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                                                    {index + 1}
                                                </div>
                                                <Avatar>
                                                    <AvatarImage src={winner.avatar} />
                                                    <AvatarFallback>
                                                        {winner.name[0].toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">
                                                        {winner.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(winner.drawnAt).toLocaleTimeString('pt-BR')}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Layout>
    );
}
