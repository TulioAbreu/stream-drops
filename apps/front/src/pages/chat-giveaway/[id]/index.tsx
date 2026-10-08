import { Layout } from "@/components/layout";
import { useParams, useNavigate } from "react-router";
import { useChatGiveawayDb, type ChatGiveawayWinner } from "@/database/ChatGiveaway";
import { useExclusionListDb } from "@/database/ExclusionListItem";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import type { ChatGiveawayFormData } from "@/database/ChatGiveaway";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Trophy, Sparkles, ArrowLeftIcon, Edit, AlertCircle, HardDrive } from "lucide-react";
import { useChatListener } from "../hooks/use-chat-listener";
import {
  buildChatGiveawayPools,
  sameStringSet,
  unionChatParticipants,
} from "../eligible-participants";
import { drawWinner, summarizeChatDrawChance } from "@/service/chat-giveaway";
import { toast } from "sonner";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { composeTwitchChatEmbedUrl, formatChancePercentage } from "@/lib/utils";
import { rankWinnersByDrawOrder, sortWinnersByDrawOrder } from "@/lib/giveaway-winner-rank";
import { WinnersList } from "@/components/giveaway/winners-list";
import { WinnerMoment } from "@/components/giveaway/winner-moment";
import { WinnerLogRow } from "@/components/giveaway/winner-log-row";
import { PendingWinnerCard } from "@/components/giveaway/pending-winner-card";
import { WinnerBadgeSurface } from "@/components/giveaway/winner-badge-surface";
import {
  browserClock,
  chatPreviewWin,
  confirmedWin,
} from "@/components/giveaway/winner-badge-win";
import {
  noteGiveawayConfirmed,
  noteGiveawayWinnerRemoved,
} from "@/lib/winner-badges/readiness";
import { ParticipantInventory } from "@/components/giveaway/participant-inventory";
import { InventoryPanel } from "@/components/shell/inventory-panel";
import { ShellHeader } from "@/components/shell/shell-header";
import { useTranslation } from "react-i18next";
import "@/i18n";
import type { ChatParticipant } from "../types";
import { chatWinnerContextFromParticipant } from "../winner-context";
import { redirectIfGiveawayDeleted } from "@/pages/giveaway-deleted";
import { useRedirectWhenMissing } from "@/pages/use-redirect-when-missing";

export function ChatGiveawayDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getChatGiveaway, updateChatGiveaway } = useChatGiveawayDb();
  const { getExclusions } = useExclusionListDb();
  const { userData, twitchApiClient } = useTwitchApi();
  const [giveaway, setGiveaway] = useState<ChatGiveawayFormData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [excludedUserIds, setExcludedUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [missing, setMissing] = useState(false);
  useRedirectWhenMissing(missing, "/dashboard");

  const getChatGiveawayRef = useRef(getChatGiveaway);
  const getExclusionsRef = useRef(getExclusions);
  getChatGiveawayRef.current = getChatGiveaway;
  getExclusionsRef.current = getExclusions;

  // Winner confirmation modal state
  const [pendingWinner, setPendingWinner] = useState<ChatParticipant | null>(null);

  // Use chat listener when we have user data and giveaway data
  const {
    allParticipants,
    messages,
    connectionStatus,
    error: chatError,
    flushParticipants,
  } = useChatListener({
    channel: userData?.login || "",
    keyword: giveaway?.keyword || "",
    minimumSuscriptionTimeInMonths: giveaway?.minimumSuscriptionTimeInMonths || 0,
    subscribersOnly: giveaway?.subscribersOnly || false,
    twitchApiClient: twitchApiClient || undefined,
    broadcasterId: userData?.id,
    excludedUserIds,
    giveawayId: id,
  });

  const liveParticipantsRef = useRef(allParticipants);
  const giveawayRef = useRef(giveaway);
  const broadcasterIdRef = useRef(userData?.id);
  liveParticipantsRef.current = allParticipants;
  giveawayRef.current = giveaway;
  broadcasterIdRef.current = userData?.id;

  const refreshExclusions = useCallback(async () => {
    const exclusions = await getExclusionsRef.current();
    const next = new Set(exclusions.map((item) => item.twitchUserId));
    setExcludedUserIds((current) => (sameStringSet(current, next) ? current : next));
  }, []);

  // Filtro por nome é só exibição. O sorteio usa a união menos exclusão e broadcaster.
  const pools = useMemo(
    () =>
      buildChatGiveawayPools({
        saved: giveaway?.participants ?? [],
        live: allParticipants,
        excludedUserIds,
        broadcasterId: userData?.id,
        nameFilter,
      }),
    [
      giveaway?.participants,
      allParticipants,
      excludedUserIds,
      userData?.id,
      nameFilter,
    ],
  );
  const { persisted: knownParticipants, eligible, displayed } = pools;

  // Sort participants by joinedAt (newest first) for display only
  const sortedParticipants = useMemo(
    () => [...displayed].sort((a, b) => b.joinedAt - a.joinedAt),
    [displayed],
  );

  // Ordem cronológica: 1º em cima, último embaixo
  const sortedWinners = useMemo(
    () => sortWinnersByDrawOrder(giveaway?.winners ?? []),
    [giveaway?.winners]
  );

  const winnerRanks = useMemo(
    () => rankWinnersByDrawOrder(giveaway?.winners ?? []),
    [giveaway?.winners]
  );
  const pendingWinnerRank = (giveaway?.winners.length ?? 0) + 1;
  const previewWin = useMemo(
    () => (giveaway && pendingWinner ? chatPreviewWin(giveaway, pendingWinner) : null),
    [giveaway, pendingWinner],
  );
  const previewClock = useMemo(
    () => browserClock(),
    [pendingWinner?.id],
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const loadGiveaway = async () => {
      const data = await getChatGiveawayRef.current(id);
      if (cancelled) return;
      if (!data) {
        setMissing(true);
        return;
      }
      setMissing(false);
      setGiveaway(data);
    };

    loadGiveaway();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    refreshExclusions();
  }, [refreshExclusions]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshExclusions();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshExclusions]);

  const onClickBack = () => {
    navigate("/dashboard/chat-giveaway");
  };

  const [redrawExcludedIds, setRedrawExcludedIds] = useState<string[]>([]);
  const [isRedrawing, setIsRedrawing] = useState(false);

  // Clear redraw excluded IDs when confirmation is closed (confirmed or cancelled)
  useEffect(() => {
    if (!pendingWinner) {
      setRedrawExcludedIds([]);
    }
  }, [pendingWinner]);

  const executeDraw = async (excludeIds: string[]) => {
    const currentGiveaway = giveawayRef.current;
    if (!currentGiveaway) return;

    const exclusions = await getExclusionsRef.current();
    const latestExcluded = new Set(exclusions.map((item) => item.twitchUserId));
    setExcludedUserIds((current) =>
      sameStringSet(current, latestExcluded) ? current : latestExcluded,
    );

    const drawPools = buildChatGiveawayPools({
      saved: currentGiveaway.participants ?? [],
      live: liveParticipantsRef.current,
      excludedUserIds: latestExcluded,
      broadcasterId: broadcasterIdRef.current,
      nameFilter: "",
    });

    const winner = drawWinner({
      participants: drawPools.eligible,
      subscriberMultiplier: currentGiveaway.subscriberMultiplier,
      excludeIds,
    });

    if (!winner) {
      toast.error("Todos os participantes já foram sorteados!");
      setIsDrawing(false);
      setIsRedrawing(false); // Make sure to stop this loading state too
      return;
    }

    const { winChance, winnerTickets } = summarizeChatDrawChance({
      participants: drawPools.eligible,
      winner,
      subscriberMultiplier: currentGiveaway.subscriberMultiplier,
      excludeIds,
    });
    const winChanceFormatted = formatChancePercentage(winChance);

    if (userData?.id && twitchApiClient) {
      await twitchApiClient.sendChatMessage({
        broadcaster_id: userData.id,
        sender_id: userData.id,
        message: `Parabéns @${winner.displayName}! Você ganhou o sorteio! (Chance: ${winChanceFormatted}, Tickets: ${winnerTickets})`
      });
    }

    // Show inline confirmation instead of adding directly to winners
    setPendingWinner(winner);
    setIsDrawing(false);
    setIsRedrawing(false);
  }

  const handleDraw = async () => {
    if (!giveaway || eligible.length === 0) {
      toast.error("Não há participantes elegíveis para sortear!");
      return;
    }

    setIsDrawing(true);
    const flushed = flushParticipants();

    // Simulate drawing animation delay
    setTimeout(async () => {
      await flushed;
      const excludeIds = giveaway.winners.map(w => w.twitchId);
      await executeDraw(excludeIds);
    }, 500);
  };

  const handleRedraw = async () => {
    if (!giveaway || !pendingWinner) return;

    setIsRedrawing(true);
    const flushed = flushParticipants();

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
      await flushed;
      await executeDraw(allExcludedIds);
    }, 500);
  };

  const handleConfirmWinner = async () => {
    if (!giveaway || !pendingWinner) return;

    const participants = unionChatParticipants(
      giveaway.participants ?? [],
      liveParticipantsRef.current,
    );
    const source = participants.find((item) => item.id === pendingWinner.id)
      ?? pendingWinner;
    const newWinner: ChatGiveawayWinner = {
      id: pendingWinner.id,
      name: pendingWinner.displayName,
      twitchId: pendingWinner.id,
      avatar: pendingWinner.avatar,
      drawnAt: new Date().toISOString(),
      context: chatWinnerContextFromParticipant(source),
    };

    const updatedGiveaway = {
      ...giveaway,
      winners: [...giveaway.winners, newWinner],
      participants,
      updatedAt: new Date().toISOString(),
    };

    try {
      const saved = await updateChatGiveaway(updatedGiveaway);
      if (redirectIfGiveawayDeleted(saved, navigate, "/dashboard")) return;
      setGiveaway(updatedGiveaway);
      noteGiveawayConfirmed("chat", updatedGiveaway);
      toast.success(`🎉 ${pendingWinner.displayName} foi confirmado como vencedor!`);
    } catch (error) {
      console.error("Error saving winner and participants:", error);
      toast.error("Erro ao salvar vencedor. Tente novamente.");
      throw error;
    }
  };

  const handleDismissPendingWinner = () => {
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

    const saved = await updateChatGiveaway(updatedGiveaway);
    if (redirectIfGiveawayDeleted(saved, navigate, "/dashboard")) return;
    setGiveaway(updatedGiveaway);
    noteGiveawayWinnerRemoved("chat", updatedGiveaway);

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

  const connectionLabel =
    connectionStatus === "connected"
      ? t("CHAT_GIVEAWAY_STATUS_CONNECTED")
      : connectionStatus === "connecting"
        ? t("CHAT_GIVEAWAY_STATUS_CONNECTING")
        : connectionStatus === "error"
          ? t("CHAT_GIVEAWAY_STATUS_ERROR")
          : null;

  return (
    <Layout>
      <div className="flex flex-col gap-4">
        <ShellHeader
          section={t("DASHBOARD_SIDEBAR_SECTION_GIVEAWAYS")}
          page={t("DASHBOARD_SIDEBAR_ITEM_CHAT_GIVEAWAY")}
          title={giveaway.title}
          description={giveaway.description || undefined}
          actions={
            <>
              <Button variant="ghost" size="lg" onClick={onClickBack}>
                <ArrowLeftIcon />
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
                        <Edit />
                        <span>{t("CHAT_GIVEAWAY_EDIT")}</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {giveaway.winners.length > 0 && (
                    <TooltipContent>
                      <p>{t("CHAT_GIVEAWAY_EDIT_LOCKED")}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="drop"
                onClick={handleDraw}
                disabled={isDrawing || !!pendingWinner || eligible.length === 0}
              >
                {isDrawing ? (
                  <>
                    <Sparkles className="animate-spin motion-reduce:animate-none" />
                    {t("CHAT_GIVEAWAY_DRAWING")}
                  </>
                ) : (
                  <>
                    <Trophy />
                    {t("CHAT_GIVEAWAY_DRAW")}
                  </>
                )}
              </Button>
            </>
          }
        >
          {giveaway.keyword ? (
            <p className="mt-2 text-base font-medium text-foreground">
              {t("CHAT_GIVEAWAY_KEYWORD_SEND")}{" "}
              <span className="font-mono text-base font-semibold">
                {giveaway.keyword}
              </span>{" "}
              {t("CHAT_GIVEAWAY_KEYWORD_IN_CHAT")}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {giveaway.keyword ? (
              <span className="inline-flex h-[30px] items-center gap-2 rounded-[8px] border border-border bg-[var(--sd-surface-2)] px-2.5 text-[12.5px] font-semibold">
                <span className="font-medium text-muted-foreground">
                  {t("CHAT_GIVEAWAY_HUD_KEYWORD")}
                </span>
                <span className="font-mono">{giveaway.keyword}</span>
              </span>
            ) : null}
            {giveaway.subscriberMultiplier > 1 ? (
              <span className="inline-flex h-[30px] items-center gap-2 rounded-[8px] border border-border bg-[var(--sd-surface-2)] px-2.5 text-[12.5px] font-semibold">
                <span className="font-medium text-muted-foreground">
                  {t("CHAT_GIVEAWAY_HUD_MULTIPLIER")}
                </span>
                <span className="font-mono">{giveaway.subscriberMultiplier}×</span>
              </span>
            ) : null}
            <span className="inline-flex h-[30px] items-center gap-2 rounded-[8px] border border-border bg-[var(--sd-surface-2)] px-2.5 text-[12.5px] font-semibold">
              <span className="font-medium text-muted-foreground">
                {t("CHAT_GIVEAWAY_HUD_ELIGIBLE")}
              </span>
              <span className="font-mono">{eligible.length}</span>
            </span>
            {giveaway.subscribersOnly ? (
              <Badge variant="secondary">Apenas Subscribers</Badge>
            ) : null}
            {giveaway.minimumSuscriptionTimeInMonths > 0 ? (
              <Badge variant="outline">
                Necessário ter {giveaway.minimumSuscriptionTimeInMonths}{" "}
                {giveaway.minimumSuscriptionTimeInMonths === 1 ? "mês" : "meses"} de Subscription
              </Badge>
            ) : null}
            {connectionLabel ? (
              <span
                className={
                  connectionStatus === "error"
                    ? "inline-flex h-[22px] items-center gap-1.5 rounded-full bg-[var(--sd-danger-soft)] px-2 text-xs font-semibold text-foreground"
                    : connectionStatus === "connecting"
                      ? "inline-flex h-[22px] items-center gap-1.5 rounded-full bg-muted px-2 text-xs font-semibold text-foreground"
                      : "inline-flex h-[22px] items-center gap-1.5 rounded-full bg-[var(--sd-success-soft)] px-2 text-xs font-semibold text-foreground"
                }
              >
                <span
                  className={
                    connectionStatus === "error"
                      ? "size-1.5 rounded-full bg-[var(--sd-danger)]"
                      : connectionStatus === "connecting"
                        ? "size-1.5 rounded-full bg-muted-foreground"
                        : "size-1.5 rounded-full bg-[var(--sd-success)]"
                  }
                  aria-hidden
                />
                {connectionLabel}
              </span>
            ) : null}
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--sd-local)_22%,transparent)] bg-[var(--sd-local-soft)] px-2.5 text-xs font-semibold text-[var(--sd-local)]">
              <HardDrive className="size-3.5" />
              {t("CHAT_GIVEAWAY_LOCAL")}
            </span>
          </div>
        </ShellHeader>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <ParticipantInventory
            title={t("CHAT_GIVEAWAY_INVENTORY_TITLE")}
            filter={nameFilter}
            onFilterChange={setNameFilter}
            filterLabel={t("CHAT_GIVEAWAY_FILTER_PLACEHOLDER", "Filtrar por nome...")}
            participants={sortedParticipants}
            summary={
              <>
                {nameFilter.trim() ? (
                  <>
                    <p>
                      {t("CHAT_GIVEAWAY_FILTERED_COUNT", {
                        found: displayed.length,
                        eligible: eligible.length,
                        defaultValue:
                          "{{found}} encontrados (de {{eligible}} elegíveis)",
                      })}
                    </p>
                    <p>
                      {t(
                        "CHAT_GIVEAWAY_FILTER_DRAW_HINT",
                        "O sorteio considera todos os elegíveis, não só os filtrados",
                      )}
                    </p>
                  </>
                ) : (
                  <p>
                    {t("CHAT_GIVEAWAY_ELIGIBLE_COUNT", {
                      total: eligible.length,
                      defaultValue: "{{total}} participantes elegíveis",
                    })}
                  </p>
                )}
                {chatError ? (
                  <p className="text-destructive">Erro no chat: {chatError}</p>
                ) : null}
              </>
            }
            empty={
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Sparkles />
                  </EmptyMedia>
                  <EmptyTitle>
                    {nameFilter.trim()
                      ? t("CHAT_GIVEAWAY_FILTER_EMPTY", {
                          filter: nameFilter.trim(),
                          defaultValue:
                            "Nenhum participante encontrado para '{{filter}}'",
                        })
                      : t("CHAT_GIVEAWAY_NO_PARTICIPANTS", "Nenhum participante")}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            }
          />

          <div className="flex min-h-0 flex-col gap-4">
            <InventoryPanel
              title={t("CHAT_GIVEAWAY_LOG_TITLE")}
              meta={
                pendingWinner
                  ? t("CHAT_GIVEAWAY_LOG_META_PENDING", {
                      count: giveaway.winners.length,
                      rank: pendingWinnerRank,
                    })
                  : t("CHAT_GIVEAWAY_LOG_META", { count: giveaway.winners.length })
              }
              bodyClassName="pt-3"
            >
              <WinnersList
                className="h-[360px] pr-3"
                triggerKey={pendingWinner?.id ?? null}
                pendingRank={pendingWinnerRank}
                pending={
                  pendingWinner ? (
                    <PendingWinnerCard
                      name={pendingWinner.displayName}
                      hint={t("CHAT_GIVEAWAY_PENDING_WAIT")}
                      win={previewWin}
                      clock={previewClock}
                    />
                  ) : undefined
                }
              >
                {giveaway.winners.length === 0 && !pendingWinner ? (
                  <div className="flex min-h-[280px] items-center justify-center">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Trophy />
                        </EmptyMedia>
                        <EmptyTitle>{t("CHAT_GIVEAWAY_NO_WINNERS")}</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  </div>
                ) : (
                  sortedWinners
                    .filter((winner) => winner.id !== pendingWinner?.id)
                    .map((winner) => {
                      const participantData = knownParticipants.find(
                        (participant) => participant.id === winner.twitchId,
                      );
                      const rank = winnerRanks.get(winner.id) ?? 0;
                      const badgeIndex = giveaway.winners.findIndex(
                        (item) => item.id === winner.id,
                      );
                      return (
                        <WinnerLogRow
                          key={winner.id}
                          rank={rank}
                          name={winner.name}
                          avatar={winner.avatar}
                          drawnAt={winner.drawnAt}
                          tier={participantData?.tier}
                          onRemove={() => onClickRemoveWinner(winner.id)}
                          removeLabel={t("CHAT_GIVEAWAY_REMOVE_WINNER")}
                          dimmed={!!pendingWinner}
                          badgeWin={confirmedWin(
                            "chat",
                            giveaway,
                            winner.twitchId,
                            badgeIndex,
                          )}
                        />
                      );
                    })
                )}
              </WinnersList>
            </InventoryPanel>

            <InventoryPanel
              title={t("CHAT_GIVEAWAY_CHAT_TITLE")}
              meta={
                connectionStatus === "connected" ? (
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <span className="size-1.5 rounded-full bg-[var(--sd-success)]" />
                    {t("CHAT_GIVEAWAY_LIVE")}
                  </span>
                ) : null
              }
              className="overflow-hidden"
              bodyClassName="p-0"
            >
              {userData?.login ? (
                <iframe
                  src={composeTwitchChatEmbedUrl(userData.login)}
                  className="h-[220px] w-full border-0"
                  title={`Chat do canal ${userData.login}`}
                />
              ) : (
                <div className="flex h-[220px] flex-col items-center justify-center bg-muted p-6">
                  <AlertCircle className="mb-3 size-8 text-destructive" />
                  <p className="text-center text-sm font-medium text-destructive">
                    Não foi possível montar o chat: dados do usuário ausentes.
                  </p>
                </div>
              )}
            </InventoryPanel>
          </div>
        </div>
      </div>
      {pendingWinner ? (
        <WinnerMoment
          key={pendingWinner.id}
          pendingWinner={pendingWinner}
          messages={messages}
          rank={pendingWinnerRank}
          giveawayTitle={giveaway.title}
          onConfirm={handleConfirmWinner}
          onDismiss={handleDismissPendingWinner}
          onCancel={handleCancelWinner}
          onRedraw={handleRedraw}
          isRedrawing={isRedrawing}
          badges={
            <WinnerBadgeSurface
              surface="reveal"
              preview
              win={previewWin}
              clock={previewClock}
            />
          }
        />
      ) : null}
    </Layout>
  );
}
