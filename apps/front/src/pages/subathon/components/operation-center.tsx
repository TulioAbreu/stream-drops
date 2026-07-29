import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";
import { Loader2, Pause, Pencil, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ManualCreditForm } from "./manual-credit-form";
import { TimeInput } from "./time-input";
import type { ConversionRule, ConversionUnit } from "@stream-drops/subathon-protocol";
import {
  formatSignedDuration,
  formatTimerHms,
} from "../utils";

interface OperationCenterProps {
  timerLabel: string;
  isActiveHere: boolean;
  connected: boolean;
  timerStatus: string | undefined;
  currentRemainingMs: number;
  conversionRules: ConversionRule[];
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onAddMinutes: (minutes: number) => void;
  onSetRemaining: (remainingMs: number) => boolean;
  onAddCredit: (unit: ConversionUnit, amount: number) => void;
}

export function OperationCenter({
  timerLabel,
  isActiveHere,
  connected,
  timerStatus,
  currentRemainingMs,
  conversionRules,
  onPlay,
  onPause,
  onReset,
  onAddMinutes,
  onSetRemaining,
  onAddCredit,
}: OperationCenterProps) {
  const { t } = useTranslation();
  const [resetOpen, setResetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editMs, setEditMs] = useState(currentRemainingMs);
  const [savingEdit, setSavingEdit] = useState(false);

  const canEditTime =
    isActiveHere && connected && timerStatus === "paused";
  const editDeltaMs = editMs - currentRemainingMs;

  const handleConfirmEdit = () => {
    setSavingEdit(true);
    const sent = onSetRemaining(editMs);
    setSavingEdit(false);

    if (sent) {
      setEditOpen(false);
      toast.success(t("SUBATHON_EDIT_TIME_SUCCESS"));
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>{t("SUBATHON_ZONE_OPERATION")}</CardTitle>
        <CardDescription>{t("SUBATHON_TIMER_DESCRIPTION")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          role="timer"
          aria-live="off"
          aria-label={t("SUBATHON_TIMER_ARIA")}
          className="font-mono text-5xl tracking-widest"
        >
          {timerLabel}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onPlay} disabled={!isActiveHere || !connected}>
            <Play className="size-4" />
            {t("SUBATHON_PLAY")}
          </Button>
          <Button
            variant="secondary"
            onClick={onPause}
            disabled={!isActiveHere || !connected}
          >
            <Pause className="size-4" />
            {t("SUBATHON_PAUSE")}
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Dialog
                    open={editOpen}
                    onOpenChange={(open) => {
                      setEditOpen(open);
                      if (open) {
                        setEditMs(currentRemainingMs);
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={!canEditTime}
                      >
                        <Pencil className="size-4" />
                        {t("SUBATHON_EDIT_TIME")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("SUBATHON_EDIT_TIME")}</DialogTitle>
                        <DialogDescription>
                          {t("SUBATHON_EDIT_TIME_DESCRIPTION")}
                        </DialogDescription>
                      </DialogHeader>
                      <TimeInput
                        valueMs={editMs}
                        onChangeMs={setEditMs}
                      />
                      <div className="text-sm text-muted-foreground">
                        <p>
                          {t("SUBATHON_EDIT_TIME_NEW", {
                            time: formatTimerHms(editMs),
                          })}
                        </p>
                        <p>
                          {t("SUBATHON_EDIT_TIME_DELTA", {
                            delta: formatSignedDuration(editDeltaMs),
                          })}
                        </p>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">
                            {t("SUBATHON_CANCEL")}
                          </Button>
                        </DialogClose>
                        <Button
                          onClick={handleConfirmEdit}
                          disabled={savingEdit}
                        >
                          {savingEdit ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : null}
                          {t("SUBATHON_EDIT_TIME_CONFIRM")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </span>
              </TooltipTrigger>
              {!canEditTime ? (
                <TooltipContent>
                  {t("SUBATHON_EDIT_TIME_REQUIRES_PAUSE")}
                </TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>

          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!isActiveHere || !connected}>
                <RotateCcw className="size-4" />
                {t("SUBATHON_RESET")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("SUBATHON_RESET")}</DialogTitle>
                <DialogDescription>
                  {t("SUBATHON_RESET_CONFIRM")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("SUBATHON_CANCEL")}</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onReset();
                      setResetOpen(false);
                    }}
                  >
                    {t("SUBATHON_RESET")}
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() => onAddMinutes(1)}
            disabled={!isActiveHere || !connected}
          >
            {t("SUBATHON_ADD_MINUTES", { minutes: 1 })}
          </Button>
          <Button
            variant="outline"
            onClick={() => onAddMinutes(5)}
            disabled={!isActiveHere || !connected}
          >
            {t("SUBATHON_ADD_MINUTES", { minutes: 5 })}
          </Button>
          <Button
            variant="outline"
            onClick={() => onAddMinutes(10)}
            disabled={!isActiveHere || !connected}
          >
            {t("SUBATHON_ADD_MINUTES", { minutes: 10 })}
          </Button>
        </div>

        {!isActiveHere ? (
          <Badge variant="secondary">{t("SUBATHON_INACTIVE_SESSION_HINT")}</Badge>
        ) : null}

        <ManualCreditForm
          rules={conversionRules}
          disabled={!isActiveHere || !connected}
          onAdd={onAddCredit}
        />
      </CardContent>
    </Card>
  );
}
