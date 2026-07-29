import { Badge } from "@/components/ui/badge";
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";
import type { TimerStatus } from "@stream-drops/subathon-protocol";
import { ArrowRight, PlusIcon, Timer, TrashIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { OverlayUrlActions } from "./components/overlay-url-actions";
import { useSubathon } from "./hooks/use-subathon";
import { formatSessionDate, formatTimerHms } from "./utils";

function statusBadgeVariant(
  status: TimerStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "running":
      return "default";
    case "paused":
      return "secondary";
    case "ended":
      return "outline";
    default:
      return "outline";
  }
}

function statusLabel(
  status: TimerStatus,
  t: (key: string) => string,
): string {
  switch (status) {
    case "running":
      return t("SUBATHON_STATUS_RUNNING");
    case "paused":
      return t("SUBATHON_STATUS_PAUSED");
    case "ended":
      return t("SUBATHON_STATUS_ENDED");
    default:
      return t("SUBATHON_STATUS_IDLE");
  }
}

export function SubathonListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const subathon = useSubathon();

  const onCreate = () => navigate("/dashboard/subathon/create");
  const onOpen = (id: string) => navigate(`/dashboard/subathon/${id}`);
  const onDelete = (id: string) => {
    subathon.deleteSession(id);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("SUBATHON_TITLE")}</h1>
          <p className="text-muted-foreground">{t("SUBATHON_DESCRIPTION")}</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <OverlayUrlActions />
          <Button onClick={onCreate} disabled={!subathon.connected}>
            <PlusIcon className="size-4" />
            {t("SUBATHON_CREATE_SESSION")}
          </Button>
        </div>
      </div>

      {!subathon.connected ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Timer />
            </EmptyMedia>
            <EmptyTitle>{t("SUBATHON_ONBOARDING_TITLE")}</EmptyTitle>
            <EmptyDescription>
              {t("SUBATHON_ONBOARDING_DESCRIPTION")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="text-left text-sm text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-5">
              <li>{t("SUBATHON_ONBOARDING_STEP_1")}</li>
              <li>{t("SUBATHON_ONBOARDING_STEP_2")}</li>
              <li>{t("SUBATHON_ONBOARDING_STEP_3")}</li>
            </ol>
            <Button className="mt-4" onClick={onCreate} disabled>
              <PlusIcon className="size-4" />
              {t("SUBATHON_CREATE_SESSION")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}

      {subathon.connected && subathon.sessions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Timer />
            </EmptyMedia>
            <EmptyTitle>{t("SUBATHON_EMPTY_TITLE")}</EmptyTitle>
            <EmptyDescription>
              {t("SUBATHON_EMPTY_DESCRIPTION")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={onCreate}>
              <PlusIcon className="size-4" />
              {t("SUBATHON_CREATE_SESSION")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}

      {subathon.sessions.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("SUBATHON_SESSION_NAME")}</TableHead>
              <TableHead>{t("SUBATHON_SESSION_CREATED")}</TableHead>
              <TableHead>{t("SUBATHON_SESSION_LAST_RUN")}</TableHead>
              <TableHead>{t("SUBATHON_SESSION_STATUS")}</TableHead>
              <TableHead>{t("SUBATHON_SESSION_REMAINING")}</TableHead>
              <TableHead className="text-right">
                {t("SUBATHON_SESSION_ACTIONS")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subathon.sessions.map((session) => {
              const isActive = subathon.activeSessionId === session.id;
              return (
                <TableRow key={session.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium text-primary hover:underline"
                      onClick={() => onOpen(session.id)}
                    >
                      {session.name}
                    </button>
                    {isActive ? (
                      <Badge className="ml-2" variant="secondary">
                        {t("SUBATHON_BADGE_ACTIVE")}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatSessionDate(session.createdAt)}</TableCell>
                  <TableCell>
                    {formatSessionDate(session.lastRunAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(session.snapshot.status)}>
                      {statusLabel(session.snapshot.status, t)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {formatTimerHms(session.snapshot.remainingMs)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("SUBATHON_OPEN_SESSION")}
                              onClick={() => onOpen(session.id)}
                            >
                              <ArrowRight className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t("SUBATHON_OPEN_SESSION")}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("SUBATHON_DELETE")}
                          >
                            <TrashIcon className="size-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {t("SUBATHON_DELETE_TITLE")}
                            </DialogTitle>
                            <DialogDescription>
                              {t("SUBATHON_DELETE_DESCRIPTION", {
                                name: session.name,
                              })}
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">
                                {t("SUBATHON_CANCEL")}
                              </Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button
                                variant="destructive"
                                onClick={() => onDelete(session.id)}
                              >
                                {t("SUBATHON_DELETE")}
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
