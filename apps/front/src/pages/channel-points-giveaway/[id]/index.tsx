import { Layout } from "@/components/layout";
import { useParams, useNavigate } from "react-router";
import {
  useChannelPointsGiveawayDb,
  type ChannelPointsGiveawayFormData,
  type ChannelPointsParticipant,
  type ChannelPointsWinner,
} from "@/database/ChannelPointsGiveaway";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Trophy,
  Sparkles,
  ArrowLeftIcon,
  Edit,
  Pause,
  Lock,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { cn, composeTwitchChatEmbedUrl, formatChancePercentage } from "@/lib/utils";
import { rankWinnersByDrawOrder, sortWinnersByDrawOrder } from "@/lib/giveaway-winner-rank";
import { WinnersList } from "@/components/giveaway/winners-list";
import { WinnerMoment } from "@/components/giveaway/winner-moment";
import { WinnerLogRow } from "@/components/giveaway/winner-log-row";
import { ParticipantInventory } from "@/components/giveaway/participant-inventory";
import { InventoryPanel } from "@/components/shell/inventory-panel";
import { ShellHeader } from "@/components/shell/shell-header";
import { useTranslation } from "@/i18n";
import { v7 } from "uuid";
import { useExclusionListDb } from "@/database/ExclusionListItem";
import {
  collectChannelPointsRedemptions,
  type CollectionProgress,
} from "@/usecase/collect-channel-points-redemptions";
import { settleChannelPointsOnClose } from "@/usecase/settle-channel-points-on-close";
import {
  drawChannelPointsWinner,
  getAvailableTicketCount,
  getWeightedEntryCount,
  normalizeChannelPointsMultiplier,
  resolveChannelPointsMultiplier,
} from "@/service/channel-points-giveaway";
import { SubscriberTierLabels } from "@/domain/SubscriberTier";
import type { SubscriberTier } from "@/domain/SubscriberTier";
import {
  channelPointsAccessBlockI18nKeys,
  channelPointsErrorI18nKey,
  classifyChannelPointsApiError,
  getChannelPointsAccessBlock,
} from "@/lib/channel-points-access";
import { ChannelPointsAccessBanner } from "../components/channel-points-access-banner";
import { useChatMessages } from "../hooks/use-chat-messages";
import { redirectIfGiveawayDeleted } from "@/pages/giveaway-deleted";
import { useRedirectWhenMissing } from "@/pages/use-redirect-when-missing";

function statusSoft(status: ChannelPointsGiveawayFormData["status"]): string {
  if (status === "ready") return "bg-[var(--sd-warning-soft)]";
  if (status === "closed") return "bg-muted";
  if (status === "collecting") return "bg-[var(--sd-local-soft)]";
  return "bg-[var(--sd-success-soft)]";
}

function statusDot(status: ChannelPointsGiveawayFormData["status"]): string {
  if (status === "ready") return "bg-[var(--sd-warning)]";
  if (status === "closed") return "bg-muted-foreground";
  if (status === "collecting") return "bg-[var(--sd-local)]";
  return "bg-[var(--sd-success)]";
}

function HudChip({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <span className="inline-flex h-[30px] items-center gap-2 rounded-[8px] border border-border bg-[var(--sd-surface-2)] px-2.5 text-[12.5px] font-semibold">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </span>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex min-w-[140px] flex-1 flex-col rounded-[14px] border border-border bg-card px-4 py-3 shadow-[var(--sd-shadow-1)]">
      <span className="font-display text-[28px] leading-none font-extrabold tabular-nums">
        {value}
      </span>
      <span className="mt-1.5 text-xs font-semibold text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

interface PendingChannelPointsWinner {
  participant: ChannelPointsParticipant;
  redemptionId: string;
  weight: number;
}

export function ChannelPointsGiveawayDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    getChannelPointsGiveaway,
    updateChannelPointsGiveaway,
  } = useChannelPointsGiveawayDb();
  const { getExclusions } = useExclusionListDb();
  const { userData, twitchApiClient } = useTwitchApi();
  const accessBlock = getChannelPointsAccessBlock({
    broadcasterType: userData?.broadcasterType,
    scopes: userData?.scopes,
  });
  const canUseChannelPoints = accessBlock === null;

  const [giveaway, setGiveaway] =
    useState<ChannelPointsGiveawayFormData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [collectionProgress, setCollectionProgress] =
    useState<CollectionProgress | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [pendingWinner, setPendingWinner] =
    useState<PendingChannelPointsWinner | null>(null);
  const [redrawExcludedRedemptionIds, setRedrawExcludedRedemptionIds] =
    useState<string[]>([]);
  const [isRedrawing, setIsRedrawing] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [missing, setMissing] = useState(false);
  useRedirectWhenMissing(missing, "/dashboard/channel-points-giveaway");

  const chatEnabled =
    !!userData?.login &&
    (giveaway?.status === "ready" || giveaway?.status === "closed");

  const { messages, connectionStatus } = useChatMessages({
    channel: userData?.login || "",
    enabled: chatEnabled,
  });

  useEffect(() => {
    if (!id) return;

    const loadGiveaway = async () => {
      const data = await getChannelPointsGiveaway(id);
      if (!data) {
        setMissing(true);
        return;
      }
      setMissing(false);
      setGiveaway({
        ...data,
        maxPerStream: data.maxPerStream ?? null,
      });
    };

    loadGiveaway();
  }, [id, getChannelPointsGiveaway]);

  useEffect(() => {
    if (!pendingWinner) {
      setRedrawExcludedRedemptionIds([]);
    }
  }, [pendingWinner]);

  const availableTickets = useMemo(() => {
    if (!giveaway) return 0;
    return getAvailableTicketCount(
      giveaway.participants,
      giveaway.winners,
      giveaway.allowMultipleWins,
      redrawExcludedRedemptionIds
    );
  }, [giveaway, redrawExcludedRedemptionIds]);

  const subscriberMultiplier = useMemo(
    () => normalizeChannelPointsMultiplier(giveaway?.subscriberMultiplier),
    [giveaway?.subscriberMultiplier]
  );

  const weightedEntries = useMemo(() => {
    if (!giveaway) return 0;
    return getWeightedEntryCount({
      participants: giveaway.participants,
      winners: giveaway.winners,
      allowMultipleWins: giveaway.allowMultipleWins,
      subscriberMultiplier,
      excludeRedemptionIds: redrawExcludedRedemptionIds,
    });
  }, [giveaway, subscriberMultiplier, redrawExcludedRedemptionIds]);

  const inventoryParticipants = useMemo(() => {
    const query = nameFilter.trim().toLowerCase();
    return [...(giveaway?.participants ?? [])]
      .filter((participant) => {
        if (!query) return true;
        return (
          participant.displayName.toLowerCase().includes(query) ||
          participant.name.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.tickets.length - a.tickets.length)
      .map((participant) => {
        const weight = resolveChannelPointsMultiplier(
          participant,
          subscriberMultiplier
        );
        return {
          id: participant.userId,
          displayName: participant.displayName,
          avatar: participant.avatar,
          subscriber: participant.subscriber,
          tier: participant.tier,
          mark: `×${participant.tickets.length * weight}`,
        };
      });
  }, [giveaway?.participants, nameFilter, subscriberMultiplier]);

  const sortedWinners = useMemo(
    () => sortWinnersByDrawOrder(giveaway?.winners ?? []),
    [giveaway?.winners]
  );

  const winnerRanks = useMemo(
    () => rankWinnersByDrawOrder(giveaway?.winners ?? []),
    [giveaway?.winners]
  );
  const pendingWinnerRank = (giveaway?.winners.length ?? 0) + 1;

  const progressValue = useMemo(() => {
    if (!collectionProgress) return 0;
    if (collectionProgress.phase === "fetching") {
      return Math.min(60, 10 + collectionProgress.page * 5);
    }
    if (collectionProgress.phase === "enriching") return 75;
    if (collectionProgress.phase === "settling") return 90;
    return 100;
  }, [collectionProgress]);

  const onClickBack = () => {
    navigate("/dashboard/channel-points-giveaway");
  };

  const canEdit =
    giveaway?.status === "open" && (giveaway?.winners.length ?? 0) === 0;

  const handleCollect = async () => {
    if (!giveaway || !twitchApiClient || !userData?.id || !giveaway.rewardId) {
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_ERROR_NOT_AUTHENTICATED"));
      return;
    }

    if (accessBlock) {
      toast.error(t(channelPointsAccessBlockI18nKeys(accessBlock).toast));
      return;
    }

    setIsCollecting(true);
    setCollectionProgress({ loaded: 0, page: 0, phase: "fetching" });

    try {
      const collectingGiveaway: ChannelPointsGiveawayFormData = {
        ...giveaway,
        status: "collecting",
        updatedAt: new Date().toISOString(),
      };
      const savedCollecting = await updateChannelPointsGiveaway(collectingGiveaway);
      if (
        redirectIfGiveawayDeleted(
          savedCollecting,
          navigate,
          "/dashboard/channel-points-giveaway",
        )
      ) {
        return;
      }
      setGiveaway(collectingGiveaway);

      const pauseResult = await twitchApiClient.updateCustomReward({
        broadcaster_id: userData.id,
        id: giveaway.rewardId,
        is_paused: true,
      });

      if (pauseResult.isErr()) {
        const kind = classifyChannelPointsApiError(pauseResult.error);
        toast.error(
          kind === "generic"
            ? t("CHANNEL_POINTS_GIVEAWAY_PAUSE_ERROR")
            : t(channelPointsErrorI18nKey(kind))
        );
        const reverted: ChannelPointsGiveawayFormData = {
          ...giveaway,
          status: "open",
          updatedAt: new Date().toISOString(),
        };
        const savedRevert = await updateChannelPointsGiveaway(reverted);
        if (
          redirectIfGiveawayDeleted(
            savedRevert,
            navigate,
            "/dashboard/channel-points-giveaway",
          )
        ) {
          return;
        }
        setGiveaway(reverted);
        return;
      }

      const exclusions = await getExclusions();
      const excludedUserIds = new Set(exclusions.map((e) => e.twitchUserId));

      const collectResult = await collectChannelPointsRedemptions({
        twitchApiClient,
        broadcasterId: userData.id,
        rewardId: giveaway.rewardId,
        subscribersOnly: giveaway.subscribersOnly,
        subscriptionRequirement: giveaway.subscriptionRequirement,
        refundIneligible: giveaway.refundIneligible,
        excludedUserIds,
        onProgress: setCollectionProgress,
      });

      if (collectResult.isErr()) {
        console.error(collectResult.error);
        const kind = classifyChannelPointsApiError(collectResult.error);
        toast.error(
          kind === "generic"
            ? t("CHANNEL_POINTS_GIVEAWAY_COLLECT_ERROR")
            : t(channelPointsErrorI18nKey(kind))
        );
        const reverted: ChannelPointsGiveawayFormData = {
          ...giveaway,
          status: "open",
          updatedAt: new Date().toISOString(),
        };
        await twitchApiClient.updateCustomReward({
          broadcaster_id: userData.id,
          id: giveaway.rewardId,
          is_paused: false,
        });
        const savedRevert = await updateChannelPointsGiveaway(reverted);
        if (
          redirectIfGiveawayDeleted(
            savedRevert,
            navigate,
            "/dashboard/channel-points-giveaway",
          )
        ) {
          return;
        }
        setGiveaway(reverted);
        return;
      }

      const readyGiveaway: ChannelPointsGiveawayFormData = {
        ...giveaway,
        status: "ready",
        participants: collectResult.value.participants,
        collectionProgress: {
          loaded: collectResult.value.totalRedemptions,
          page: collectionProgress?.page ?? 0,
        },
        updatedAt: new Date().toISOString(),
      };

      const savedReady = await updateChannelPointsGiveaway(readyGiveaway);
      if (
        redirectIfGiveawayDeleted(
          savedReady,
          navigate,
          "/dashboard/channel-points-giveaway",
        )
      ) {
        return;
      }
      setGiveaway(readyGiveaway);

      toast.success(
        t("CHANNEL_POINTS_GIVEAWAY_COLLECT_SUCCESS", {
          eligible: collectResult.value.eligibleCount,
          ineligible: collectResult.value.ineligibleCount,
        })
      );
    } catch (error) {
      console.error(error);
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_COLLECT_ERROR"));
    } finally {
      setIsCollecting(false);
      setCollectionProgress(null);
    }
  };

  const executeDraw = async (excludeRedemptionIds: string[]) => {
    if (!giveaway) return;

    const result = drawChannelPointsWinner({
      participants: giveaway.participants,
      winners: giveaway.winners,
      allowMultipleWins: giveaway.allowMultipleWins,
      subscriberMultiplier: giveaway.subscriberMultiplier,
      excludeRedemptionIds,
    });

    if (!result) {
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_NO_TICKETS"));
      setIsDrawing(false);
      setIsRedrawing(false);
      return;
    }

    const poolSize = getWeightedEntryCount({
      participants: giveaway.participants,
      winners: giveaway.winners,
      allowMultipleWins: giveaway.allowMultipleWins,
      subscriberMultiplier: giveaway.subscriberMultiplier,
      excludeRedemptionIds,
    });
    const chance = poolSize > 0 ? (result.weight / poolSize) * 100 : 0;

    if (userData?.id && twitchApiClient) {
      await twitchApiClient.sendChatMessage({
        broadcaster_id: userData.id,
        sender_id: userData.id,
        message: t("CHANNEL_POINTS_GIVEAWAY_CHAT_WINNER", {
          name: result.participant.displayName,
          chance: formatChancePercentage(chance),
        }),
      });
    }

    setPendingWinner({
      participant: result.participant,
      redemptionId: result.redemptionId,
      weight: result.weight,
    });
    setIsDrawing(false);
    setIsRedrawing(false);
  };

  const handleDraw = async () => {
    if (!giveaway) return;

    if (availableTickets === 0) {
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_NO_TICKETS"));
      return;
    }

    setIsDrawing(true);

    setTimeout(async () => {
      await executeDraw([]);
    }, 500);
  };

  const handleRedraw = async () => {
    if (!giveaway || !pendingWinner) return;

    setIsRedrawing(true);

    const sessionExcludes = giveaway.allowMultipleWins
      ? [pendingWinner.redemptionId]
      : pendingWinner.participant.tickets.map((ticket) => ticket.redemptionId);

    const newExcluded = [
      ...redrawExcludedRedemptionIds,
      ...sessionExcludes.filter(
        (redemptionId) => !redrawExcludedRedemptionIds.includes(redemptionId)
      ),
    ];
    setRedrawExcludedRedemptionIds(newExcluded);

    setTimeout(async () => {
      await executeDraw(newExcluded);
    }, 500);
  };

  const handleConfirmWinner = async () => {
    if (!giveaway || !pendingWinner) return;

    const newWinner: ChannelPointsWinner = {
      id: v7(),
      userId: pendingWinner.participant.userId,
      name: pendingWinner.participant.displayName,
      avatar: pendingWinner.participant.avatar,
      redemptionId: pendingWinner.redemptionId,
      drawnAt: new Date().toISOString(),
    };

    const updatedGiveaway: ChannelPointsGiveawayFormData = {
      ...giveaway,
      winners: [...giveaway.winners, newWinner],
      updatedAt: new Date().toISOString(),
    };

    try {
      const saved = await updateChannelPointsGiveaway(updatedGiveaway);
      if (
        redirectIfGiveawayDeleted(
          saved,
          navigate,
          "/dashboard/channel-points-giveaway",
        )
      ) {
        return;
      }
      setGiveaway(updatedGiveaway);
      toast.success(
        t("CHANNEL_POINTS_GIVEAWAY_DRAW_SUCCESS", {
          name: pendingWinner.participant.displayName,
        })
      );
    } catch (error) {
      console.error(error);
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_DRAW_ERROR"));
      throw error;
    }
  };

  const onClickRemoveWinner = async (winnerId: string) => {
    if (!giveaway) return;

    const updatedGiveaway: ChannelPointsGiveawayFormData = {
      ...giveaway,
      winners: giveaway.winners.filter((w) => w.id !== winnerId),
      updatedAt: new Date().toISOString(),
    };

    const saved = await updateChannelPointsGiveaway(updatedGiveaway);
    if (
      redirectIfGiveawayDeleted(
        saved,
        navigate,
        "/dashboard/channel-points-giveaway",
      )
    ) {
      return;
    }
    setGiveaway(updatedGiveaway);
    toast.success(t("CHANNEL_POINTS_GIVEAWAY_WINNER_REMOVED"));
  };

  const handleClose = async () => {
    if (!giveaway || !twitchApiClient || !userData?.id) return;

    if (accessBlock) {
      toast.error(t(channelPointsAccessBlockI18nKeys(accessBlock).toast));
      return;
    }

    setIsClosing(true);
    try {
      if (giveaway.rewardId) {
        const settleResult = await settleChannelPointsOnClose({
          twitchApiClient,
          broadcasterId: userData.id,
          rewardId: giveaway.rewardId,
          participants: giveaway.participants,
          hasWinners: giveaway.winners.length > 0,
        });

        if (settleResult.isErr()) {
          console.error(settleResult.error);
          const kind = classifyChannelPointsApiError(settleResult.error);
          toast.error(
            kind === "generic"
              ? t("CHANNEL_POINTS_GIVEAWAY_CLOSE_SETTLE_ERROR")
              : t(channelPointsErrorI18nKey(kind))
          );
          return;
        }

        const deleteResult = await twitchApiClient.deleteCustomReward({
          broadcaster_id: userData.id,
          id: giveaway.rewardId,
        });
        if (deleteResult.isErr()) {
          const kind = classifyChannelPointsApiError(deleteResult.error);
          toast.error(
            kind === "generic"
              ? t("CHANNEL_POINTS_GIVEAWAY_CLOSE_REWARD_ERROR")
              : t(channelPointsErrorI18nKey(kind))
          );
          return;
        }
      }

      const closedGiveaway: ChannelPointsGiveawayFormData = {
        ...giveaway,
        status: "closed",
        rewardId: null,
        updatedAt: new Date().toISOString(),
      };

      const saved = await updateChannelPointsGiveaway(closedGiveaway);
      if (
        redirectIfGiveawayDeleted(
          saved,
          navigate,
          "/dashboard/channel-points-giveaway",
        )
      ) {
        return;
      }
      setGiveaway(closedGiveaway);
      setPendingWinner(null);
      setCloseDialogOpen(false);
      toast.success(t("CHANNEL_POINTS_GIVEAWAY_CLOSE_SUCCESS"));
    } catch (error) {
      console.error(error);
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_CLOSE_ERROR"));
    } finally {
      setIsClosing(false);
    }
  };

  if (!giveaway) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  const totalParticipantTickets = giveaway.participants.reduce(
    (sum, p) => sum + p.tickets.length,
    0
  );

  return (
    <Layout>
      <div className="flex flex-col gap-4">
        <ShellHeader
          section={t("DASHBOARD_SIDEBAR_SECTION_GIVEAWAYS")}
          page={t("DASHBOARD_SIDEBAR_ITEM_CHANNEL_POINTS_GIVEAWAY")}
          title={giveaway.title}
          description={giveaway.description || undefined}
          actions={
            <>
              <Button variant="ghost" size="lg" onClick={onClickBack}>
                <ArrowLeftIcon />
                {t("NAVIGATE_BACK")}
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() =>
                          navigate(
                            `/dashboard/channel-points-giveaway/${giveaway.id}/edit`
                          )
                        }
                        disabled={!canEdit}
                      >
                        <Edit />
                        {t("CHANNEL_POINTS_GIVEAWAY_EDIT_BUTTON")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!canEdit && (
                    <TooltipContent>
                      <p>{t("CHANNEL_POINTS_GIVEAWAY_EDIT_BLOCKED")}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              {giveaway.status === "ready" && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setCloseDialogOpen(true)}
                  disabled={!canUseChannelPoints || !!pendingWinner}
                  className="border-[color-mix(in_srgb,var(--sd-danger)_45%,transparent)] bg-[var(--sd-danger-soft)] text-foreground hover:bg-[var(--sd-danger-soft)]"
                >
                  <Lock />
                  {t("CHANNEL_POINTS_GIVEAWAY_CLOSE")}
                </Button>
              )}
              {giveaway.status === "open" && (
                <Button
                  variant="drop"
                  onClick={handleCollect}
                  disabled={isCollecting || !canUseChannelPoints}
                >
                  <Pause />
                  {t("CHANNEL_POINTS_GIVEAWAY_PAUSE_COLLECT")}
                </Button>
              )}
              {giveaway.status === "ready" && (
                <Button
                  variant="drop"
                  onClick={handleDraw}
                  disabled={isDrawing || !!pendingWinner || availableTickets === 0}
                >
                  {isDrawing ? (
                    <>
                      <Sparkles className="animate-spin motion-reduce:animate-none" />
                      {t("CHANNEL_POINTS_GIVEAWAY_DRAWING")}
                    </>
                  ) : (
                    <>
                      <Trophy />
                      {t("CHANNEL_POINTS_GIVEAWAY_DRAW")}
                    </>
                  )}
                </Button>
              )}
            </>
          }
        >
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-foreground",
                statusSoft(giveaway.status),
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", statusDot(giveaway.status))}
                aria-hidden
              />
              {t(
                "CHANNEL_POINTS_GIVEAWAY_STATUS_" + giveaway.status.toUpperCase(),
              )}
            </span>
            <HudChip
              label={t("CHANNEL_POINTS_GIVEAWAY_HUD_COST")}
              value={t("CHANNEL_POINTS_GIVEAWAY_COST_BADGE", {
                cost: giveaway.cost,
              })}
            />
            {giveaway.maxPerStream != null && giveaway.maxPerStream >= 1 && (
              <HudChip
                label={t("CHANNEL_POINTS_GIVEAWAY_FORM_MAX_PER_STREAM_VALUE")}
                value={giveaway.maxPerStream}
              />
            )}
            {giveaway.subscribersOnly && (
              <span className="inline-flex h-[26px] items-center rounded-full border border-border bg-[var(--sd-surface-2)] px-2.5 text-xs font-semibold text-foreground">
                {t("CHANNEL_POINTS_GIVEAWAY_SUBS_ONLY_BADGE", {
                  tier:
                    SubscriberTierLabels[
                      giveaway.subscriptionRequirement as SubscriberTier
                    ] ?? giveaway.subscriptionRequirement,
                })}
              </span>
            )}
            {Object.entries(subscriberMultiplier)
              .filter(([, multiplier]) => multiplier > 1)
              .map(([tier, multiplier]) => (
                <HudChip
                  key={tier}
                  label={
                    SubscriberTierLabels[Number(tier) as SubscriberTier] ?? tier
                  }
                  value={`${multiplier}×`}
                />
              ))}
            {giveaway.allowMultipleWins && (
              <span className="inline-flex h-[26px] items-center rounded-full border border-border bg-[var(--sd-surface-2)] px-2.5 text-xs font-semibold text-foreground">
                {t("CHANNEL_POINTS_GIVEAWAY_MULTI_WINS_BADGE")}
              </span>
            )}
            {giveaway.refundIneligible && (
              <span className="inline-flex h-[26px] items-center rounded-full border border-border bg-[var(--sd-surface-2)] px-2.5 text-xs font-semibold text-foreground">
                {t("CHANNEL_POINTS_GIVEAWAY_REFUND_BADGE")}
              </span>
            )}
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--sd-local)_22%,transparent)] bg-[var(--sd-local-soft)] px-2.5 text-xs font-semibold text-[var(--sd-local)]">
              <HardDrive className="size-3.5" />
              {t("CHANNEL_POINTS_GIVEAWAY_LOCAL")}
            </span>
          </div>
        </ShellHeader>

        {accessBlock && giveaway.status !== "closed" && (
          <ChannelPointsAccessBanner reason={accessBlock} />
        )}

        {giveaway.status === "open" && (
          <InventoryPanel title={t("CHANNEL_POINTS_GIVEAWAY_OPEN_TITLE")}>
            <p className="text-sm text-muted-foreground">
              {t("CHANNEL_POINTS_GIVEAWAY_OPEN_DESCRIPTION")}
            </p>
          </InventoryPanel>
        )}

        {(giveaway.status === "ready" || giveaway.status === "closed") && (
          <>
            <div className="flex flex-wrap gap-3">
              <Stat
                value={giveaway.participants.length}
                label={t("CHANNEL_POINTS_GIVEAWAY_STAT_PARTICIPANTS")}
              />
              <Stat
                value={availableTickets}
                label={t("CHANNEL_POINTS_GIVEAWAY_STAT_TICKETS")}
              />
              <Stat
                value={weightedEntries}
                label={t("CHANNEL_POINTS_GIVEAWAY_STAT_WEIGHTED")}
              />
              <Stat
                value={giveaway.winners.length}
                label={t("CHANNEL_POINTS_GIVEAWAY_STAT_WINNERS")}
              />
            </div>
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
              <ParticipantInventory
                title={t("CHANNEL_POINTS_GIVEAWAY_INVENTORY_TITLE")}
                status={t("CHANNEL_POINTS_GIVEAWAY_INVENTORY_META")}
                filter={nameFilter}
                onFilterChange={setNameFilter}
                filterLabel={t("CHANNEL_POINTS_GIVEAWAY_FILTER_PLACEHOLDER")}
                participants={inventoryParticipants}
                summary={
                  <>
                    {nameFilter.trim() ? (
                      <>
                        <p>
                          {t("CHANNEL_POINTS_GIVEAWAY_FILTERED_COUNT", {
                            found: inventoryParticipants.length,
                            total: giveaway.participants.length,
                          })}
                        </p>
                        <p>{t("CHANNEL_POINTS_GIVEAWAY_FILTER_DRAW_HINT")}</p>
                      </>
                    ) : (
                      <p>
                        {t("CHANNEL_POINTS_GIVEAWAY_TICKETS_COUNT", {
                          count: totalParticipantTickets,
                        })}
                        {weightedEntries !== availableTickets
                          ? ` · ${t("CHANNEL_POINTS_GIVEAWAY_WEIGHTED_ENTRIES", {
                              count: weightedEntries,
                            })}`
                          : ` · ${t("CHANNEL_POINTS_GIVEAWAY_AVAILABLE_TICKETS", {
                              count: availableTickets,
                            })}`}
                      </p>
                    )}
                  </>
                }
                empty={
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Trophy />
                      </EmptyMedia>
                      <EmptyTitle>
                        {nameFilter.trim()
                          ? t("CHANNEL_POINTS_GIVEAWAY_FILTER_EMPTY", {
                              filter: nameFilter.trim(),
                            })
                          : t("CHANNEL_POINTS_GIVEAWAY_NO_PARTICIPANTS")}
                      </EmptyTitle>
                      {!nameFilter.trim() ? (
                        <EmptyDescription>
                          {t("CHANNEL_POINTS_GIVEAWAY_NO_PARTICIPANTS_HINT")}
                        </EmptyDescription>
                      ) : null}
                    </EmptyHeader>
                  </Empty>
                }
              />
              <div className="flex min-h-0 flex-col gap-4">
                <InventoryPanel
                  title={t("CHANNEL_POINTS_GIVEAWAY_LOG_TITLE")}
                  meta={
                    pendingWinner
                      ? t("CHANNEL_POINTS_GIVEAWAY_LOG_META_PENDING", {
                          count: giveaway.winners.length,
                          rank: pendingWinnerRank,
                        })
                      : t("CHANNEL_POINTS_GIVEAWAY_LOG_META", {
                          count: giveaway.winners.length,
                        })
                  }
                  bodyClassName="pt-3"
                >
                  <WinnersList
                    className="h-[360px] pr-3"
                    triggerKey={pendingWinner?.redemptionId ?? null}
                    pendingRank={pendingWinnerRank}
                    pending={
                      pendingWinner ? (
                        <div
                          data-pending-card
                          className="rounded-[14px] border border-dashed border-[var(--sd-border-strong)] bg-card px-3 py-3"
                        >
                          <p className="text-sm font-semibold">
                            {pendingWinner.participant.displayName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("CHANNEL_POINTS_GIVEAWAY_PENDING_WAIT")}
                          </p>
                        </div>
                      ) : undefined
                    }
                  >
                    {sortedWinners.length === 0 && !pendingWinner ? (
                      <div className="flex min-h-[280px] items-center justify-center">
                        <Empty>
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Trophy />
                            </EmptyMedia>
                            <EmptyTitle>
                              {t("CHANNEL_POINTS_GIVEAWAY_NO_WINNERS")}
                            </EmptyTitle>
                          </EmptyHeader>
                        </Empty>
                      </div>
                    ) : (
                      sortedWinners.map((winner) => {
                        const participant = giveaway.participants.find(
                          (item) => item.userId === winner.userId,
                        );
                        const rank = winnerRanks.get(winner.id) ?? 0;
                        return (
                          <WinnerLogRow
                            key={winner.id}
                            rank={rank}
                            name={winner.name}
                            avatar={winner.avatar}
                            drawnAt={winner.drawnAt}
                            tier={participant?.tier}
                            onRemove={
                              giveaway.status !== "closed"
                                ? () => onClickRemoveWinner(winner.id)
                                : undefined
                            }
                            removeLabel={t("CHANNEL_POINTS_GIVEAWAY_REMOVE_WINNER")}
                            dimmed={!!pendingWinner}
                          />
                        );
                      })
                    )}
                  </WinnersList>
                </InventoryPanel>
                {userData?.login && (
                  <InventoryPanel
                    title={t("CHANNEL_POINTS_GIVEAWAY_CHAT_TITLE")}
                    meta={
                      connectionStatus === "connected" ? (
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          <span className="size-1.5 rounded-full bg-[var(--sd-success)]" />
                          {t("CHANNEL_POINTS_GIVEAWAY_LIVE")}
                        </span>
                      ) : null
                    }
                    className="overflow-hidden"
                    bodyClassName="p-0"
                  >
                    <iframe
                      title="Twitch Chat"
                      src={composeTwitchChatEmbedUrl(userData.login)}
                      className="h-[220px] w-full border-0"
                    />
                  </InventoryPanel>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {pendingWinner ? (
        <WinnerMoment
          key={pendingWinner.redemptionId}
          pendingWinner={{
            id: pendingWinner.participant.userId,
            displayName: pendingWinner.participant.displayName,
            avatar: pendingWinner.participant.avatar,
            subscriber: pendingWinner.participant.subscriber,
            tier: pendingWinner.participant.tier,
          }}
          messages={messages}
          rank={pendingWinnerRank}
          giveawayTitle={giveaway.title}
          onConfirm={handleConfirmWinner}
          onDismiss={() => setPendingWinner(null)}
          onCancel={() => setPendingWinner(null)}
          onRedraw={handleRedraw}
          isRedrawing={isRedrawing}
        />
      ) : null}

      <Dialog open={isCollecting} onOpenChange={() => {}}>
        <DialogContent
          hideCloseButton
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_TITLE")}
            </DialogTitle>
            <DialogDescription>
              {collectionProgress?.phase === "fetching" &&
                t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_FETCHING", {
                  loaded: collectionProgress.loaded,
                  page: collectionProgress.page,
                })}
              {collectionProgress?.phase === "enriching" &&
                t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_ENRICHING", {
                  loaded: collectionProgress.loaded,
                })}
              {collectionProgress?.phase === "settling" &&
                t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_SETTLING")}
              {!collectionProgress &&
                t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_STARTING")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Progress value={progressValue} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              {collectionProgress
                ? t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_LOADED", {
                    loaded: collectionProgress.loaded,
                    page: collectionProgress.page,
                  })
                : "..."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("CHANNEL_POINTS_GIVEAWAY_CLOSE_DIALOG_TITLE")}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t("CHANNEL_POINTS_GIVEAWAY_CLOSE_DIALOG_DESCRIPTION")}</p>
                <p>
                  {giveaway.winners.length > 0
                    ? t("CHANNEL_POINTS_GIVEAWAY_CLOSE_DIALOG_FULFILL")
                    : t("CHANNEL_POINTS_GIVEAWAY_CLOSE_DIALOG_REFUND")}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseDialogOpen(false)}
              disabled={isClosing}
            >
              {t("CANCEL")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleClose}
              disabled={isClosing}
              loading={isClosing}
            >
              {t("CHANNEL_POINTS_GIVEAWAY_CLOSE")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
