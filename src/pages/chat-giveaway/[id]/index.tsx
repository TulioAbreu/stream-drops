import { Layout } from "@/components/layout";
import { useParams, useNavigate } from "react-router";
import { useChatGiveawayDb, type ChatGiveawayWinner } from "@/database/ChatGiveaway";
import { useEffect, useState, useMemo } from "react";
import type { ChatGiveawayFormData } from "@/database/ChatGiveaway";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Trophy, Sparkles, ArrowLeftIcon, XIcon, Wifi, WifiOff, Edit } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { useChatListener } from "../hooks/use-chat-listener";
import { drawWinner } from "@/service/chat-giveaway";
import { toast } from "sonner";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { composeTwitchChatEmbedUrl, formatChancePercentage } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { ChatParticipant } from "../types";
import { WinnerConfirmationModal } from "./components/winner-confirmation-modal";
import { SubscriptionTierBadge } from "./components/subscription-tier-badge";
import { ParticipantTag } from "./components/participant-tag";

export function ChatGiveawayDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getChatGiveaway, updateChatGiveaway } = useChatGiveawayDb();
  const { userData, twitchApiClient } = useTwitchApi();
  const [giveaway, setGiveaway] = useState<ChatGiveawayFormData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Winner confirmation modal state
  const [pendingWinner, setPendingWinner] = useState<ChatParticipant | null>(null);

  // Use chat listener when we have user data and giveaway data
  const {
    participants: liveParticipants,
    allParticipants,
    messages,
    isConnected,
    connectionStatus,
    error: chatError,
    reconnect,
    filterParticipants,
    nameFilter
  } = useChatListener({
    channel: userData?.login || "",
    keyword: giveaway?.keyword || "",
    minimumSuscriptionTimeInMonths: giveaway?.minimumSuscriptionTimeInMonths || 0,
    subscribersOnly: giveaway?.subscribersOnly || false,
    twitchApiClient: twitchApiClient || undefined,
    broadcasterId: userData?.id,
  });

  // Merge saved participants with live participants (deduplicate by id)
  const participants = useMemo(() => {
    const savedParticipants = giveaway?.participants || [];
    const participantsMap = new Map<string, ChatParticipant>();

    // Add saved participants first
    savedParticipants.forEach(p => participantsMap.set(p.id, p));

    // Add/update with live participants
    liveParticipants.forEach(p => participantsMap.set(p.id, p));

    return Array.from(participantsMap.values());
  }, [giveaway?.participants, liveParticipants]);

  // Sort participants by joinedAt (newest first) for display only
  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => b.joinedAt - a.joinedAt),
    [participants]
  );

  // Sort winners by drawnAt (newest first) for display
  const sortedWinners = useMemo(
    () =>
      [...(giveaway?.winners ?? [])].sort(
        (a, b) => new Date(b.drawnAt).getTime() - new Date(a.drawnAt).getTime()
      ),
    [giveaway?.winners]
  );

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

  const onClickBack = () => {
    navigate("/dashboard/chat-giveaway");
  };

  const [redrawExcludedIds, setRedrawExcludedIds] = useState<string[]>([]);
  const [isRedrawing, setIsRedrawing] = useState(false);

  // Clear redraw excluded IDs when modal is closed (confirmed or cancelled)
  useEffect(() => {
    if (!pendingWinner) {
      setRedrawExcludedIds([]);
    }
  }, [pendingWinner]);

  const executeDraw = async (excludeIds: string[]) => {
    if (!giveaway) return;

    const winner = drawWinner({
      participants,
      subscriberMultiplier: giveaway.subscriberMultiplier,
      excludeIds,
    });

    if (!winner) {
      toast.error("Todos os participantes já foram sorteados!");
      setIsDrawing(false);
      setIsRedrawing(false); // Make sure to stop this loading state too
      return;
    }

    // Calculate chance and send chat message
    const eligibleParticipants = participants.filter(p => !excludeIds.includes(p.id));

    const participantsWithTickets = eligibleParticipants.map(participant => {
      const multiplier = participant.subscriber ? giveaway.subscriberMultiplier : 1;
      return {
        participant,
        tickets: multiplier
      };
    });

    const totalTickets = participantsWithTickets.reduce((sum, p) => sum + p.tickets, 0);
    const winnerTickets = winner.subscriber ? giveaway.subscriberMultiplier : 1;
    const winChance = (winnerTickets / totalTickets) * 100;
    const winChanceFormatted = formatChancePercentage(winChance);

    if (userData?.id && twitchApiClient) {
      await twitchApiClient.sendChatMessage({
        broadcaster_id: userData.id,
        sender_id: userData.id,
        message: `Parabéns @${winner.displayName}! Você ganhou o sorteio! (Chance: ${winChanceFormatted}, Tickets: ${winnerTickets})`
      });
    }

    // Open confirmation modal instead of adding directly to winners
    setPendingWinner(winner);
    setIsDrawing(false);
    setIsRedrawing(false);
  }

  const handleDraw = async () => {
    if (!giveaway || participants.length === 0) {
      toast.error("Não há participantes elegíveis para sortear!");
      return;
    }

    setIsDrawing(true);

    // Simulate drawing animation delay
    setTimeout(async () => {
      const excludeIds = giveaway.winners.map(w => w.twitchId);
      await executeDraw(excludeIds);
    }, 500);
  };

  const handleRedraw = async () => {
    if (!giveaway || !pendingWinner) return;

    setIsRedrawing(true);

    // Add current pending winner to excluded list for this session
    const newExcludedIds = [...redrawExcludedIds, pendingWinner.id];
    setRedrawExcludedIds(newExcludedIds);

    // Combine with already confirmed winners
    const allExcludedIds = [
      ...giveaway.winners.map(w => w.twitchId),
      ...newExcludedIds
    ];

    // Simulate drawing animation delay
    setTimeout(async () => {
      await executeDraw(allExcludedIds);
    }, 500);
  };

  const handleConfirmWinner = async () => {
    if (!giveaway || !pendingWinner) return;

    const newWinner: ChatGiveawayWinner = {
      id: pendingWinner.id,
      name: pendingWinner.displayName,
      twitchId: pendingWinner.id,
      avatar: pendingWinner.avatar,
      drawnAt: new Date().toISOString(),
    };

    const updatedGiveaway = {
      ...giveaway,
      winners: [...giveaway.winners, newWinner],
      participants: participants,
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateChatGiveaway(updatedGiveaway);
      setGiveaway(updatedGiveaway);


      toast.success(`🎉 ${pendingWinner.displayName} foi confirmado como vencedor!`);
    } catch (error) {
      console.error("Error saving winner and participants:", error);
      toast.error("Erro ao salvar vencedor. Tente novamente.");
    }

    // Reset modal state
    setPendingWinner(null);
  };

  const handleCancelWinner = () => {
    setPendingWinner(null);
    toast.info("Sorteio cancelado");
  };

  const onClickRemoveWinner = async (winnerId: string) => {
    if (!giveaway) return;

    const newWinners = giveaway.winners.filter((winner) => winner.id !== winnerId);

    const updatedGiveaway = {
      ...giveaway,
      winners: newWinners,
      updatedAt: new Date().toISOString(),
    };

    await updateChatGiveaway(updatedGiveaway);
    setGiveaway(updatedGiveaway);

    toast.success("Vencedor removido com sucesso!");
  };

  if (!giveaway) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-4">
        {/* Header with Actions */}
        <div className="flex flex-row justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{giveaway.title}</h1>
            {giveaway.description && (
              <p className="text-muted-foreground">{giveaway.description}</p>
            )}
            {giveaway.keyword && (
              <p className="text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
                Envie <Badge variant="secondary" className="font-mono">{giveaway.keyword}</Badge> no chat para participar
              </p>
            )}
            <div className="flex gap-2 mt-3">
              {giveaway.keyword && (
                <Badge variant="outline">Palavra-chave: {giveaway.keyword}</Badge>
              )}
              {giveaway.subscribersOnly && (
                <Badge variant="secondary">Apenas Subscribers</Badge>
              )}
              {giveaway.minimumSuscriptionTimeInMonths > 0 && (
                <Badge variant="outline">
                  Necessário ter {giveaway.minimumSuscriptionTimeInMonths} {giveaway.minimumSuscriptionTimeInMonths === 1 ? 'mês' : 'meses'} de Subscription
                </Badge>
              )}
              {giveaway.subscriberMultiplier > 1 && (
                <Badge variant="outline">
                  Multiplicador Sub: {giveaway.subscriberMultiplier}x
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-row gap-4 flex-wrap">
            <Button variant="ghost" size="lg" onClick={onClickBack}>
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              <span>{t("NAVIGATE_BACK", "Voltar")}</span>
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => navigate(`/dashboard/chat-giveaway/${giveaway.id}/edit`)}
                      disabled={giveaway.winners.length > 0}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      <span>Editar</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                {giveaway.winners.length > 0 && (
                  <TooltipContent>
                    <p>Este sorteio já ocorreu e não pode mais ser editado.</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="outline"
              size="lg"
              onClick={handleDraw}
              disabled={isDrawing || participants.length === 0}
            >
              {isDrawing ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Sorteando...
                </>
              ) : (
                <>
                  <Trophy className="w-4 h-4 mr-2" />
                  Sortear Vencedor
                </>
              )}
            </Button>
          </div>
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
              {participants.length === 0 ? (
                <div className="flex items-center justify-center h-[460px] mt-3">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Sparkles />
                      </EmptyMedia>
                      <EmptyTitle>Nenhum participante</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <div className="h-[460px] mt-3 overflow-auto content-start">
                  <div className="flex flex-wrap gap-2 p-1">
                    {sortedParticipants.map((participant) => (
                      <ParticipantTag
                        key={participant.id}
                        participant={participant}
                      />
                    ))}
                  </div>
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
                    <div className="flex items-center justify-center h-full min-h-[400px]">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Trophy />
                          </EmptyMedia>
                          <EmptyTitle>
                            Nenhum vencedor ainda
                          </EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    </div>
                  ) : (
                    sortedWinners.map((winner, index) => {
                      // Find participant data for this winner to get tier info
                      const participantData = participants.find(p => p.id === winner.twitchId);

                      return (
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
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate">
                                {winner.name}
                              </p>
                              <SubscriptionTierBadge tier={participantData?.tier} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(winner.drawnAt).toLocaleTimeString('pt-BR')}
                            </p>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onClickRemoveWinner(winner.id)}
                                >
                                  <XIcon className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Remover vencedor
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Column */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Chat da Twitch
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <WifiOff className="w-4 h-4 text-destructive animate-pulse" />
                )}
              </CardTitle>
              <CardDescription>
                {userData?.login ? `Canal: ${userData.login}` : "Carregando canal..."}
                {!isConnected && userData?.login && connectionStatus === "error" && (
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={reconnect}
                      className="h-6 px-2 text-xs"
                    >
                      Reconectar
                    </Button>
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

        </div>
      </div>

      {/* Winner Confirmation Modal */}
      <WinnerConfirmationModal
        pendingWinner={pendingWinner}
        messages={messages}
        onConfirm={handleConfirmWinner}
        onCancel={handleCancelWinner}
        onRedraw={handleRedraw}
        isRedrawing={isRedrawing}
        key={pendingWinner?.id}
      />
    </Layout>
  );
}
