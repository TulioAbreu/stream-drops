import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useChannelPointsGiveawayDb,
  type ChannelPointsGiveawayFormData,
} from "@/database/ChannelPointsGiveaway";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Coins, MoreHorizontal, Plus, TrashIcon } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { toast } from "sonner";
import { hasChannelPointsAccess } from "@/lib/channel-points-access";
import { ChannelPointsAccessBanner } from "./components/channel-points-access-banner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ITEMS_PER_PAGE = 10;

const STATUS_VARIANT: Record<
  ChannelPointsGiveawayFormData["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  open: "default",
  collecting: "secondary",
  ready: "outline",
  closed: "secondary",
};

export function ChannelPointsGiveawayPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    getChannelPointsGiveaways,
    deleteChannelPointsGiveaway,
  } = useChannelPointsGiveawayDb();
  const { twitchApiClient, userData } = useTwitchApi();
  const canUseChannelPoints = hasChannelPointsAccess(userData?.broadcasterType);

  const [isLoading, setIsLoading] = useState(false);
  const [giveaways, setGiveaways] = useState<ChannelPointsGiveawayFormData[]>(
    []
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleting, startDeleteTransition] = useTransition();

  const totalPages = Math.ceil(giveaways.length / ITEMS_PER_PAGE);
  const currentGiveaways = giveaways.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const fetchGiveaways = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    const data = await getChannelPointsGiveaways();
    data.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setGiveaways(data);
    if (showLoading) setIsLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchGiveaways();
  }, [fetchGiveaways]);

  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={i === currentPage}
              onClick={() => setCurrentPage(i)}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            isActive={1 === currentPage}
            onClick={() => setCurrentPage(1)}
            className="cursor-pointer"
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={i === currentPage}
              onClick={() => setCurrentPage(i)}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            isActive={totalPages === currentPage}
            onClick={() => setCurrentPage(totalPages)}
            className="cursor-pointer"
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  const onClickDelete = (giveaway: ChannelPointsGiveawayFormData) => {
    startDeleteTransition(async () => {
      try {
        if (
          giveaway.rewardId &&
          giveaway.status !== "closed" &&
          twitchApiClient &&
          userData?.id
        ) {
          const deleteResult = await twitchApiClient.deleteCustomReward({
            broadcaster_id: userData.id,
            id: giveaway.rewardId,
          });
          if (deleteResult.isErr()) {
            console.warn(
              "Failed to delete Twitch reward:",
              deleteResult.error
            );
          }
        }

        await deleteChannelPointsGiveaway(giveaway.id);
        await fetchGiveaways(false);
        toast.success(t("CHANNEL_POINTS_GIVEAWAY_DELETE_SUCCESS"));
      } catch (error) {
        console.error(error);
        toast.error(t("CHANNEL_POINTS_GIVEAWAY_DELETE_ERROR"));
      }
    });
  };

  return (
    <Layout>
      <div className="flex flex-row justify-between items-center mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">
          {t("CHANNEL_POINTS_GIVEAWAY_TITLE")}
        </h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={() =>
                    navigate("/dashboard/channel-points-giveaway/create")
                  }
                  disabled={!canUseChannelPoints}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("CHANNEL_POINTS_GIVEAWAY_CREATE_BUTTON")}
                </Button>
              </span>
            </TooltipTrigger>
            {!canUseChannelPoints && (
              <TooltipContent>
                <p>{t("CHANNEL_POINTS_GIVEAWAY_ERROR_NOT_AFFILIATE")}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {!canUseChannelPoints && (
        <ChannelPointsAccessBanner className="mb-6" />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : giveaways.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Coins />
            </EmptyMedia>
            <EmptyTitle>{t("CHANNEL_POINTS_GIVEAWAY_EMPTY_TITLE")}</EmptyTitle>
            <EmptyDescription>
              {canUseChannelPoints
                ? t("CHANNEL_POINTS_GIVEAWAY_EMPTY_DESCRIPTION")
                : t("CHANNEL_POINTS_GIVEAWAY_ACCESS_DENIED_DESCRIPTION")}
            </EmptyDescription>
          </EmptyHeader>
          {canUseChannelPoints && (
            <EmptyContent>
              <Button
                onClick={() =>
                  navigate("/dashboard/channel-points-giveaway/create")
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("CHANNEL_POINTS_GIVEAWAY_CREATE_BUTTON")}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t("CHANNEL_POINTS_GIVEAWAY_TABLE_HEADER_TITLE")}
                </TableHead>
                <TableHead>
                  {t("CHANNEL_POINTS_GIVEAWAY_TABLE_HEADER_STATUS")}
                </TableHead>
                <TableHead>
                  {t("CHANNEL_POINTS_GIVEAWAY_TABLE_HEADER_COST")}
                </TableHead>
                <TableHead>
                  {t("CHANNEL_POINTS_GIVEAWAY_TABLE_HEADER_WINNERS")}
                </TableHead>
                <TableHead className="text-right">
                  {t("CHANNEL_POINTS_GIVEAWAY_TABLE_HEADER_ACTIONS")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentGiveaways.map((giveaway) => (
                <TableRow key={giveaway.id}>
                  <TableCell className="font-medium">{giveaway.title}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[giveaway.status]}>
                      {t(`CHANNEL_POINTS_GIVEAWAY_STATUS_${giveaway.status.toUpperCase()}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>{giveaway.cost}</TableCell>
                  <TableCell>{giveaway.winners.length}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(
                              `/dashboard/channel-points-giveaway/${giveaway.id}`
                            )
                          }
                        >
                          <ArrowRight className="w-4 h-4 mr-2" />
                          {t("CHANNEL_POINTS_GIVEAWAY_TABLE_ACTIONS_OPEN")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <Dialog>
                          <DialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive"
                            >
                              <TrashIcon className="w-4 h-4 mr-2" />
                              {t("CHANNEL_POINTS_GIVEAWAY_TABLE_ACTIONS_DELETE")}
                            </DropdownMenuItem>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                {t("CHANNEL_POINTS_GIVEAWAY_DELETE_DIALOG_TITLE")}
                              </DialogTitle>
                              <DialogDescription>
                                {t(
                                  "CHANNEL_POINTS_GIVEAWAY_DELETE_DIALOG_DESCRIPTION"
                                )}
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">
                                  {t("CANCEL")}
                                </Button>
                              </DialogClose>
                              <Button
                                variant="destructive"
                                disabled={isDeleting}
                                onClick={() => onClickDelete(giveaway)}
                              >
                                {t("CHANNEL_POINTS_GIVEAWAY_TABLE_ACTIONS_DELETE")}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() =>
                      setCurrentPage((p) => Math.max(1, p - 1))
                    }
                    className="cursor-pointer"
                  />
                </PaginationItem>
                {renderPaginationItems()}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="cursor-pointer"
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

    </Layout>
  );
}
