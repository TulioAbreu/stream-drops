import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n";
import type {
  ConversionRule,
  ConversionUnit,
  OverlayStyle,
} from "@stream-drops/subathon-protocol";
import { ArrowLeft, Loader2, Pencil, TrashIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ConversionSettings } from "../components/conversion-settings";
import { HistoryTable } from "../components/history-table";
import { OperationCenter } from "../components/operation-center";
import { OverlayStyleSettings } from "../components/overlay-style-settings";
import { OverlayUrlActions } from "../components/overlay-url-actions";
import { TwitchIntegrationCard } from "../components/twitch-integration-card";
import { useSubathon } from "../hooks/use-subathon";
import {
  areConversionRulesEqual,
  areOverlayStylesEqual,
  DEFAULT_CONVERSION_RULES,
  formatSessionDate,
  formatTimerHms,
  normalizeOverlayStyle,
} from "../utils";

export function SubathonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    connected,
    sessions,
    activeSessionId,
    activeSession,
    setActiveSession,
    renameSession,
    deleteSession,
    updateConversion,
    updateStyle,
    play,
    pause,
    reset,
    addCredit,
    undoEntry,
    addMinutes,
    setRemaining,
    eventsubEnabled,
    eventsubConnected,
    toggleEventsub,
    displayMs,
    snapshot,
    entries,
    errorNonce,
  } = useSubathon();

  const activatedRef = useRef<string | null>(null);
  const confirmShownRef = useRef(false);
  const session = sessions.find((item) => item.id === id);

  const [nameDraft, setNameDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [rules, setRules] = useState<ConversionRule[]>(DEFAULT_CONVERSION_RULES);
  const [styleDraft, setStyleDraft] = useState<OverlayStyle>(
    normalizeOverlayStyle(undefined),
  );
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [savingStyle, setSavingStyle] = useState(false);
  const [undoingEntryId, setUndoingEntryId] = useState<string | null>(null);

  useEffect(() => {
    confirmShownRef.current = false;
    activatedRef.current = null;
  }, [id]);

  useEffect(() => {
    if (!id || !connected || !session) {
      return;
    }

    if (activatedRef.current === id) {
      return;
    }

    const otherRunning =
      activeSessionId &&
      activeSessionId !== id &&
      activeSession?.snapshot.status === "running";

    if (otherRunning && !confirmShownRef.current) {
      confirmShownRef.current = true;
      setActivateDialogOpen(true);
      return;
    }

    activatedRef.current = id;
    setActiveSession(id);
  }, [
    id,
    connected,
    session,
    activeSessionId,
    activeSession?.snapshot.status,
    setActiveSession,
  ]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setNameDraft(session.name);
    setRules(session.conversionRules);
    setStyleDraft(normalizeOverlayStyle(session.style));
    // Hydrate drafts when opening a different session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (!savingRules) {
      const rulesDirty = !areConversionRulesEqual(rules, session.conversionRules);
      if (!rulesDirty) {
        setRules(session.conversionRules);
      }
    }

    if (!savingStyle) {
      const styleDirty = !areOverlayStylesEqual(styleDraft, session.style);
      if (!styleDirty) {
        setStyleDraft(normalizeOverlayStyle(session.style));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.updatedAt, session?.conversionRules, session?.style]);

  useEffect(() => {
    if (errorNonce === 0) {
      return;
    }

    setSavingName(false);
    setSavingRules(false);
    setSavingStyle(false);
    setUndoingEntryId(null);
  }, [errorNonce]);

  useEffect(() => {
    if (!session || !savingName) {
      return;
    }

    if (session.name === nameDraft.trim()) {
      setSavingName(false);
      setEditingName(false);
      toast.success(t("SUBATHON_RENAME_SAVED"));
    }
  }, [session, savingName, nameDraft, t]);

  useEffect(() => {
    if (!session || !savingRules) {
      return;
    }

    if (areConversionRulesEqual(rules, session.conversionRules)) {
      setSavingRules(false);
      toast.success(t("SUBATHON_CONVERSION_SAVED"));
    }
  }, [session, savingRules, rules, t]);

  useEffect(() => {
    if (!session || !savingStyle) {
      return;
    }

    if (areOverlayStylesEqual(styleDraft, session.style)) {
      setSavingStyle(false);
      toast.success(t("SUBATHON_STYLE_SAVED"));
    }
  }, [session, savingStyle, styleDraft, t]);

  useEffect(() => {
    if (!undoingEntryId) {
      return;
    }

    const undone = entries.some(
      (entry) =>
        entry.type === "undo" && entry.undoOfEntryId === undoingEntryId,
    );

    if (undone) {
      setUndoingEntryId(null);
    }
  }, [entries, undoingEntryId]);

  if (!id) {
    return null;
  }

  if (connected && sessions.length > 0 && !session) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">{t("SUBATHON_SESSION_NOT_FOUND")}</p>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/subathon")}
        >
          <ArrowLeft className="size-4" />
          {t("SUBATHON_BACK_TO_LIST")}
        </Button>
      </div>
    );
  }

  const isActiveHere = activeSessionId === id;
  const timerLabel = isActiveHere
    ? formatTimerHms(displayMs)
    : formatTimerHms(session?.snapshot.remainingMs ?? 0);
  const nameDirty = session ? nameDraft.trim() !== session.name : false;
  const rulesDirty = session
    ? !areConversionRulesEqual(rules, session.conversionRules)
    : false;
  const styleDirty = session
    ? !areOverlayStylesEqual(styleDraft, session.style)
    : false;
  const currentRemainingMs = isActiveHere
    ? displayMs
    : (session?.snapshot.remainingMs ?? 0);

  const handleRename = () => {
    if (!session || !nameDraft.trim() || !connected) {
      return;
    }

    setSavingName(true);
    const sent = renameSession(session.id, nameDraft.trim());
    if (!sent) {
      setSavingName(false);
    }
  };

  const handleSaveRules = () => {
    if (!session || !connected) {
      return;
    }

    setSavingRules(true);
    const sent = updateConversion(session.id, rules);
    if (!sent) {
      setSavingRules(false);
    }
  };

  const handleSaveStyle = () => {
    if (!session || !connected) {
      return;
    }

    setSavingStyle(true);
    const sent = updateStyle(session.id, styleDraft);
    if (!sent) {
      setSavingStyle(false);
    }
  };

  const handleUndo = (entryId: string) => {
    if (!connected) {
      return;
    }

    setUndoingEntryId(entryId);
    const sent = undoEntry(entryId);
    if (!sent) {
      setUndoingEntryId(null);
    }
  };

  const handleDelete = () => {
    if (!session) {
      return;
    }

    deleteSession(session.id);
    navigate("/dashboard/subathon");
  };

  const handleConfirmActivate = () => {
    if (!id) {
      return;
    }

    activatedRef.current = id;
    setActiveSession(id);
    setActivateDialogOpen(false);
  };

  const handleCancelActivate = () => {
    setActivateDialogOpen(false);
    navigate("/dashboard/subathon");
  };

  return (
    <div className="flex flex-col gap-6">
      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("SUBATHON_SET_ACTIVE")}</DialogTitle>
            <DialogDescription>{t("SUBATHON_ACTIVATE_CONFIRM")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelActivate}>
              {t("SUBATHON_CANCEL")}
            </Button>
            <Button onClick={handleConfirmActivate}>
              {t("SUBATHON_SET_ACTIVE")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit px-0"
            onClick={() => navigate("/dashboard/subathon")}
          >
            <ArrowLeft className="size-4" />
            {t("SUBATHON_BACK_TO_LIST")}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {editingName ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  className="max-w-xs"
                />
                <Button
                  size="sm"
                  onClick={handleRename}
                  disabled={!nameDirty || savingName || !connected}
                >
                  {savingName ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {t("SUBATHON_SAVE")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingName(false);
                    setNameDraft(session?.name ?? "");
                  }}
                >
                  {t("SUBATHON_CANCEL")}
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-semibold">
                  {session?.name ?? t("SUBATHON_TITLE")}
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("SUBATHON_EDIT_NAME")}
                  onClick={() => setEditingName(true)}
                  disabled={!session}
                >
                  <Pencil className="size-4" />
                </Button>
              </>
            )}
            {isActiveHere ? (
              <Badge variant="secondary">{t("SUBATHON_BADGE_ACTIVE")}</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("SUBATHON_SESSION_CREATED")}:{" "}
            {formatSessionDate(session?.createdAt)}
            {" · "}
            {t("SUBATHON_SESSION_LAST_RUN")}:{" "}
            {formatSessionDate(session?.lastRunAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <OverlayUrlActions />
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <Button
              variant="outline"
              disabled={!session}
              onClick={() => setDeleteDialogOpen(true)}
            >
              <TrashIcon className="size-4" />
              {t("SUBATHON_DELETE")}
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("SUBATHON_DELETE_TITLE")}</DialogTitle>
                <DialogDescription>
                  {t("SUBATHON_DELETE_DESCRIPTION", {
                    name: session?.name ?? "",
                  })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  {t("SUBATHON_CANCEL")}
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  {t("SUBATHON_DELETE")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <OperationCenter
        timerLabel={timerLabel}
        isActiveHere={isActiveHere}
        connected={connected}
        timerStatus={snapshot?.status}
        currentRemainingMs={currentRemainingMs}
        conversionRules={session?.conversionRules ?? rules}
        onPlay={play}
        onPause={pause}
        onReset={() => {
          if (session) {
            reset(session.initialMs);
          }
        }}
        onAddMinutes={addMinutes}
        onSetRemaining={(remainingMs) => setRemaining(remainingMs)}
        onAddCredit={(unit: ConversionUnit, amount: number) => {
          addCredit(unit, amount);
        }}
      />

      <TwitchIntegrationCard
        enabled={eventsubEnabled}
        connected={eventsubConnected}
        serverConnected={connected}
        onToggle={toggleEventsub}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionSettings
          rules={rules}
          dirty={rulesDirty}
          saving={savingRules}
          disabled={!session || !connected}
          onChange={setRules}
          onSave={handleSaveRules}
        />
        <OverlayStyleSettings
          styleDraft={styleDraft}
          timerPreviewMs={currentRemainingMs}
          dirty={styleDirty}
          saving={savingStyle}
          disabled={!session || !connected}
          onChange={setStyleDraft}
          onSave={handleSaveStyle}
        />
      </div>

      <HistoryTable
        entries={entries.filter((entry) => entry.sessionId === id)}
        undoingEntryId={undoingEntryId}
        connected={connected}
        onUndo={handleUndo}
      />
    </div>
  );
}
