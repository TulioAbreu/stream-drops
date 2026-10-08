import { Layout } from "@/components/layout";
import { InventoryPanel } from "@/components/shell/inventory-panel";
import { ShellHeader } from "@/components/shell/shell-header";
import { WinnerMoment } from "@/components/giveaway/winner-moment";
import { WinnerBadgeSurface } from "@/components/giveaway/winner-badge-surface";
import { confirmedWin } from "@/components/giveaway/winner-badge-win";
import {
    noteGiveawayConfirmed,
    noteGiveawayWinnerRemoved,
} from "@/lib/winner-badges/readiness";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSubscriptionGiveawayDb, type FollowerGiveawayFormData } from "@/database/SubscriptionGiveaway";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { getGiveawayResult } from "@/service/giveaway";
import { exportGiveawayResultToSheets, overrideGiveawayResultToSheets } from "@/service/google-drive";
import { ArrowLeftIcon, BanIcon, Edit3Icon, EllipsisIcon, FileSpreadsheetIcon, HardDrive, PartyPopperIcon, SaveIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { TableVirtuoso } from "react-virtuoso";
import { GiveawayInfoCard } from "./components/giveaway-info-card";
import { SubscriberWinnersTable } from "./components/subscriber-winners-table";
import { fetchSubscribers } from "@/usecase/fetch-subscribers";
import { filterElegibleSubscribers } from "@/usecase/filter-eligible-subscribers";
import { toast } from "sonner";
import { useExclusionListDb } from "@/database/ExclusionListItem";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { BroadcasterSubscriber } from "@/service/twitch/types";
import { formatChancePercentage } from "@/lib/utils";
import { redirectIfGiveawayDeleted } from "@/pages/giveaway-deleted";
import { useRedirectWhenMissing } from "@/pages/use-redirect-when-missing";

export function FollowerGiveawayId() {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { getGiveaway, updateGiveaway } = useSubscriptionGiveawayDb();
    const { getExclusions, addExclusion } = useExclusionListDb();
    const { twitchApiClient, userData } = useTwitchApi();
    const [giveaway, setGiveaway] = useState<FollowerGiveawayFormData | null>(null);
    const [fetchUsersProgress, setFetchUsersProgress] = useState<number>(0);
    const [isFetchingParticipants, startFetchParticipantsTransition] = useTransition();
    const [isExportingResultSheets, startExportingResultSheetsTransition] = useTransition();
    const [revealedWinner, setRevealedWinner] = useState<BroadcasterSubscriber | null>(null);
    const [missing, setMissing] = useState(false);
    useRedirectWhenMissing(missing, "/dashboard/follower-giveaway");

    const fetchGiveaway = async () => {
        if (!id) {
            return undefined;
        }

        const giveawayData = await getGiveaway(id);
        if (giveawayData) {
            setMissing(false);
            setGiveaway(giveawayData);
            return giveawayData;
        }
        setGiveaway(null);
        setMissing(true);
        return undefined;
    };

    useEffect(() => {
        fetchGiveaway();
    }, [id]);

    const onClickBack = () => {
        navigate("/dashboard/follower-giveaway");
    };

    const onClickEdit = () => {
        navigate(`/dashboard/follower-giveaway/${id}/edit`);
    };

    const onClickSearchParticipants = async () => {
        if (!twitchApiClient || !userData || !giveaway) {
            return;
        }
        startFetchParticipantsTransition(async () => {
            setFetchUsersProgress(0);

            const exclusions = await getExclusions();

            let subscribers = await fetchSubscribers(twitchApiClient, userData.id, (progress) => {
                setFetchUsersProgress(progress);
            });
            subscribers = subscribers.filter((subscriber) => {
                // Filter out excluded users
                return !exclusions.some((exclusion) => exclusion.twitchUserId === subscriber.user_id);
            });

            if (subscribers.length === 0) {
                toast.error(t("FOLLOWER_GIVEAWAY_FORM_NO_SUBSCRIBERS"));
                return;
            }

            const eligibleSubscribers = filterElegibleSubscribers(subscribers, giveaway.subscriptionRequirement);
            const savedParticipants = await updateGiveaway({
                ...giveaway,
                participants: eligibleSubscribers
            });
            if (redirectIfGiveawayDeleted(savedParticipants, navigate, "/dashboard/follower-giveaway")) {
                return;
            }

            if (eligibleSubscribers.length === 0) {
                toast.warning(t("FOLLOWER_GIVEAWAY_FORM_NO_ELIGIBLE_SUBSCRIBERS"));
                return;
            }

            await fetchGiveaway();
        });
    };

    const onClickDrawWinners = async () => {
        if (!giveaway || !twitchApiClient || !userData) {
            return;
        }
        const newWinners = getGiveawayResult({
            participants: giveaway.participants ?? [],
            winners: giveaway.winners ?? [],
            repeatWinners: false,
            requiredSubscriber: giveaway?.subscriptionRequirement ?? 0,
            subscriberMultiplier: giveaway?.subscriberMultiplier ?? {
                "1000": 1,
                "2000": 1,
                "3000": 1,
            },
            totalWinners: 1,
        });
        const winners = [...newWinners, ...giveaway.winners];
        const savedDraw = await updateGiveaway({
            ...giveaway,
            winners,
        });
        if (redirectIfGiveawayDeleted(savedDraw, navigate, "/dashboard/follower-giveaway")) {
            return;
        }

        // Send chat message for new winners
        if (twitchApiClient && userData) {
            for (const winner of newWinners) {
                // Calculate chance
                // Re-create the pool of eligible participants at the time of drawing
                const currentWinnersIds = giveaway.winners.map(w => w.user_id);
                // Participants excluding already winners
                let eligibleParticipants = (giveaway.participants ?? []).filter(p => !currentWinnersIds.includes(p.user_id));

                // Filter by requirement
                const requiredTier = giveaway.subscriptionRequirement ?? 0;
                if (requiredTier > 0) {
                    eligibleParticipants = eligibleParticipants.filter(p => Number(p.tier) >= requiredTier);
                }

                // Calculate total tickets
                const multipliers = giveaway.subscriberMultiplier ?? { "1000": 1, "2000": 1, "3000": 1 };
                const totalTickets = eligibleParticipants.reduce((sum, p) => {
                    const multiplier = multipliers[p.tier] || 1;
                    return sum + multiplier;
                }, 0);

                const winnerTickets = multipliers[winner.tier] || 1;
                const winChance = totalTickets > 0 ? (winnerTickets / totalTickets) * 100 : 0;
                const winChanceFormatted = formatChancePercentage(winChance);

                try {
                    await twitchApiClient.sendChatMessage({
                        broadcaster_id: userData.id,
                        sender_id: userData.id,
                        message: `Parabéns @${winner.user_name}! Você ganhou o sorteio! (Chance: ${winChanceFormatted}, Tickets: ${winnerTickets})`
                    });
                } catch (error) {
                    console.error("Failed to send chat message for winner", winner.user_name, error);
                }
            }
        }

        const fresh = await fetchGiveaway();
        if (fresh) noteGiveawayConfirmed("subscribers", fresh);
        const drawnId = newWinners[0]?.user_id;
        const stamped = fresh?.winners.find((winner) => winner.user_id === drawnId);
        setRevealedWinner(stamped ?? newWinners[0] ?? null);
    };

    const onClickExportWinners = async () => {
        if (!giveaway) {
            return;
        }

        startExportingResultSheetsTransition(async () => {
            let url: string;
            if (giveaway.spreadsheetUrl) {
                url = await overrideGiveawayResultToSheets({
                    participants: giveaway.participants ?? [],
                    winners: giveaway.winners ?? [],
                    requiredSubscriber: giveaway?.subscriptionRequirement ?? 0,
                    subscriberMultiplier: giveaway?.subscriberMultiplier ?? {
                        "1000": 1,
                        "2000": 1,
                        "3000": 1,
                    },
                    title: giveaway?.title ?? "",
                    description: giveaway?.description ?? "",
                    spreadsheetId: giveaway.spreadsheetUrl.split("/")[5],
                });
                return;
            } else {
                url = await exportGiveawayResultToSheets({
                    participants: giveaway.participants ?? [],
                    winners: giveaway.winners ?? [],
                    requiredSubscriber: giveaway?.subscriptionRequirement ?? 0,
                    subscriberMultiplier: giveaway?.subscriberMultiplier ?? {
                        "1000": 1,
                        "2000": 1,
                        "3000": 1,
                    },
                    title: giveaway?.title ?? "",
                    description: giveaway?.description ?? "",
                });
            }

            const savedSheet = await updateGiveaway({
                ...giveaway,
                spreadsheetUrl: url,
            });
            if (redirectIfGiveawayDeleted(savedSheet, navigate, "/dashboard/follower-giveaway")) {
                return;
            }
            await fetchGiveaway();
        });
    };

    const onClickViewSpreadsheet = () => {
        if (!giveaway?.spreadsheetUrl) {
            return;
        }
        const newTab = window.open("about:blank", "_blank");
        if (newTab) {
            newTab.location.href = giveaway.spreadsheetUrl;
        }
    };

    const onClickRemoveParticipant = async (userId: string) => {
        if (!giveaway) {
            return;
        }
        const newParticipants = giveaway.participants.filter((user) => user.user_id !== userId);
        const savedParticipants = await updateGiveaway({
            ...giveaway,
            participants: newParticipants,
        });
        if (redirectIfGiveawayDeleted(savedParticipants, navigate, "/dashboard/follower-giveaway")) {
            return;
        }
        await fetchGiveaway();
    };

    const onClickRemoveWinner = async (userId: string) => {
        if (!giveaway) {
            return;
        }
        const newWinners = giveaway.winners.filter((user) => user.user_id !== userId);
        const savedWinners = await updateGiveaway({
            ...giveaway,
            winners: newWinners,
        });
        if (redirectIfGiveawayDeleted(savedWinners, navigate, "/dashboard/follower-giveaway")) {
            return;
        }
        const fresh = await fetchGiveaway();
        if (fresh) noteGiveawayWinnerRemoved("subscribers", fresh);
    };

    const onClickExcludeUser = async (user: BroadcasterSubscriber) => {
        if (!giveaway || !twitchApiClient) {
            return;
        }

        try {
            const twitchUser = await twitchApiClient.getUsers({
                id: user.user_id,
            });
            if (twitchUser.isErr()) {
                return;
            }

            for (const exclusion of twitchUser.value.data) {
                await addExclusion({
                    twitchUserId: exclusion.id,
                    displayName: exclusion.display_name,
                    profileImageUrl: exclusion.profile_image_url,
                    username: exclusion.login,
                    updatedAt: new Date().toISOString(),
                });
            }

            await onClickSearchParticipants();
        } catch (error) {
            console.error("Error excluding user:", error);
        }
    };

    const participants = giveaway?.participants ?? [];
    const tierCount = (tier: "1000" | "2000" | "3000") =>
        participants.filter((user) => user.tier === tier).length;
    const revealedTier =
        revealedWinner?.tier === "1000" ||
        revealedWinner?.tier === "2000" ||
        revealedWinner?.tier === "3000"
            ? (Number(revealedWinner.tier) as 1000 | 2000 | 3000)
            : null;
    const revealedWin = useMemo(() => {
        if (!giveaway || !revealedWinner) return null;
        const index = giveaway.winners.findIndex(
            (winner) => winner.user_id === revealedWinner.user_id,
        );
        if (index < 0) return null;
        return confirmedWin(
            "subscribers",
            giveaway,
            revealedWinner.user_id,
            index,
        );
    }, [giveaway, revealedWinner]);

    return (
        <Layout>
            <div className="flex flex-col gap-4">
                <ShellHeader
                    section={t("DASHBOARD_SIDEBAR_SECTION_GIVEAWAYS")}
                    page={t("DASHBOARD_SIDEBAR_ITEM_FOLLOWER_GIVEAWAY")}
                    title={giveaway === null ? <Skeleton className="h-8 w-64" /> : giveaway.title}
                    description={giveaway?.description || undefined}
                    actions={
                        <>
                            <Button variant="ghost" size="lg" onClick={onClickBack}>
                                <ArrowLeftIcon />
                                <span>{t("NAVIGATE_BACK")}</span>
                            </Button>
                            <Button variant="outline" size="lg" onClick={onClickEdit}>
                                <Edit3Icon />
                                <span>{t("FOLLOWER_GIVEAWAY_FORM_EDIT")}</span>
                            </Button>
                            <Button variant="outline" onClick={onClickSearchParticipants} size="lg">
                                <SearchIcon />
                                <span>{t("FOLLOWER_GIVEAWAY_FORM_SEARCH_PARTICIPANTS")}</span>
                            </Button>
                            <Button
                                variant="drop"
                                onClick={onClickDrawWinners}
                                disabled={giveaway?.participants === null || giveaway?.participants.length === 0}
                            >
                                <PartyPopperIcon />
                                <span>{t("FOLLOWER_GIVEAWAY_FORM_DRAW_WINNERS")}</span>
                            </Button>
                        </>
                    }
                >
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-[30px] items-center gap-2 rounded-[8px] border border-border bg-[var(--sd-surface-2)] px-2.5 text-[12.5px] font-semibold">
                            <span className="font-medium text-muted-foreground">
                                {t("FOLLOWER_GIVEAWAY_HUD_REQUIREMENT")}
                            </span>
                            <span className="font-mono">
                                {t(`TIER_${giveaway?.subscriptionRequirement ?? 0}`)}
                            </span>
                        </span>
                        {giveaway?.subscriberMultiplier &&
                            Object.entries(giveaway.subscriberMultiplier)
                                .filter(([tier]) => Number(tier) >= (giveaway?.subscriptionRequirement ?? 0))
                                .map(([tier, multiplier]) => (
                                    <span
                                        key={tier}
                                        className="inline-flex h-[30px] items-center gap-2 rounded-[8px] border border-border bg-[var(--sd-surface-2)] px-2.5 text-[12.5px] font-semibold"
                                    >
                                        <span className="font-medium text-muted-foreground">
                                            {t(`TIER_${tier}`)}
                                        </span>
                                        <span className="font-mono">{multiplier}×</span>
                                    </span>
                                ))}
                        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--sd-local)_22%,transparent)] bg-[var(--sd-local-soft)] px-2.5 text-xs font-semibold text-[var(--sd-local)]">
                            <HardDrive className="size-3.5" />
                            {t("FOLLOWER_GIVEAWAY_LOCAL")}
                        </span>
                    </div>
                </ShellHeader>
                <div className="flex flex-wrap gap-3">
                    <GiveawayInfoCard title={t("FOLLOWER_GIVEAWAY_STAT_PARTICIPANTS")}>
                        {participants.length}
                    </GiveawayInfoCard>
                    <GiveawayInfoCard title={t("TIER_1000")}>
                        {tierCount("1000")}
                    </GiveawayInfoCard>
                    <GiveawayInfoCard title={t("TIER_2000")}>
                        {tierCount("2000")}
                    </GiveawayInfoCard>
                    <GiveawayInfoCard title={t("TIER_3000")}>
                        {tierCount("3000")}
                    </GiveawayInfoCard>
                </div>
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <InventoryPanel
                        title={t("FOLLOWER_GIVEAWAY_PARTICIPANTS_PANEL")}
                        meta={String(participants.length)}
                    >
                        {(giveaway?.participants === null || giveaway?.participants.length === 0) ? (
                            <p className="text-sm text-muted-foreground">
                                {t("FOLLOWER_GIVEAWAY_FORM_NO_PARTICIPANTS")}
                            </p>
                        ) : (
                            <TableVirtuoso
                                style={{ height: "300px" }}
                                data={giveaway?.participants}
                                components={{
                                    Table,
                                    TableBody,
                                    TableRow,
                                    TableHead: TableHeader,
                                }}
                                fixedHeaderContent={() => (
                                    <TableRow>
                                        <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_TABLE_HEADER")}</TableHead>
                                        <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_SUBSCRIPTION_TIER_TABLE_HEADER")}</TableHead>
                                        <TableHead>{t("FOLLOWER_GIVEAWAY_WEIGHT")}</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                )}
                                itemContent={(_index, user) => [
                                    <TableCell key="name" className="font-semibold">{user.user_name}</TableCell>,
                                    <TableCell key="tier">{t(`TIER_${user.tier}`)}</TableCell>,
                                    <TableCell key="weight" className="font-mono">
                                        {giveaway?.subscriberMultiplier?.[user.tier] ?? 1}×
                                    </TableCell>,
                                    <TableCell key="actions">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Button variant="ghost" size="icon" onClick={() => onClickRemoveParticipant(user.user_id)}>
                                                        <XIcon />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Remover</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger>
                                                <Button variant="ghost" size="icon">
                                                    <EllipsisIcon className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => onClickExcludeUser(user)}>
                                                    <BanIcon className="w-4 h-4 mr-2" />
                                                    {t("FOLLOWER_GIVEAWAY_FORM_EXCLUDE_USER")}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                ]}
                            />
                        )}
                    </InventoryPanel>
                    <InventoryPanel
                        title={t("FOLLOWER_GIVEAWAY_LOG_TITLE")}
                        meta={t("FOLLOWER_GIVEAWAY_LOG_META", {
                            count: giveaway?.winners.length ?? 0,
                        })}
                        actions={
                            <div className="flex flex-wrap justify-end gap-2">
                                {giveaway?.spreadsheetUrl && (
                                    <Button variant="outline" size="sm" disabled={giveaway.winners === null || giveaway.winners.length === 0} onClick={onClickViewSpreadsheet}>
                                        <FileSpreadsheetIcon />
                                        Visualizar Planilha
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={giveaway?.participants === null || giveaway?.participants.length === 0}
                                    onClick={onClickExportWinners}
                                    loading={isExportingResultSheets}
                                >
                                    <SaveIcon />
                                    Exportar
                                </Button>
                            </div>
                        }
                        bodyClassName="pt-3"
                    >
                        {(giveaway?.winners === null || giveaway?.winners.length === 0) ? (
                            <div className="flex min-h-[200px] items-center justify-center">
                                <p className="text-sm text-muted-foreground">
                                    {t("FOLLOWER_GIVEAWAY_FORM_NO_WINNERS")}
                                </p>
                            </div>
                        ) : (
                            <SubscriberWinnersTable
                                winners={giveaway?.winners ?? []}
                                giveawayId={giveaway?.id}
                                onRemove={onClickRemoveWinner}
                            />
                        )}
                    </InventoryPanel>
                </div>
            </div>
            {revealedWinner ? (
                <WinnerMoment
                    key={revealedWinner.user_id}
                    pendingWinner={{
                        id: revealedWinner.user_id,
                        displayName: revealedWinner.user_name,
                        avatar: "",
                        subscriber: true,
                        tier: revealedTier,
                    }}
                    messages={[]}
                    rank={giveaway?.winners.length ?? 1}
                    giveawayTitle={giveaway?.title ?? ""}
                    showCancel={false}
                    showRedraw={false}
                    showChatWait={false}
                    confirmLabel={t("FOLLOWER_GIVEAWAY_REVEAL_DISMISS")}
                    localHint={t("FOLLOWER_GIVEAWAY_REVEAL_HINT")}
                    onConfirm={() => undefined}
                    onDismiss={() => setRevealedWinner(null)}
                    onCancel={() => setRevealedWinner(null)}
                    onRedraw={() => undefined}
                    isRedrawing={false}
                    badges={
                        <WinnerBadgeSurface
                            surface="reveal"
                            win={revealedWin}
                        />
                    }
                />
            ) : null}
            <Dialog open={isFetchingParticipants}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Aguarde...</DialogTitle>
                        <DialogDescription>
                            <p className="mb-4">Buscando participantes do sorteio.</p>
                            <Progress value={fetchUsersProgress} />
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </Layout>
    );
}
