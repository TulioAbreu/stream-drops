import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Dices, HardDrive, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { v7 } from "uuid";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WinnerMoment } from "@/components/giveaway/winner-moment";
import { InventoryPanel } from "@/components/shell/inventory-panel";
import { ShellHeader } from "@/components/shell/shell-header";
import { useRouletteDb, type RouletteData } from "@/database/Roulette";
import {
  optionsEqual,
  parseOptionsFromText,
  pickWinnerIndex,
} from "@/service/roulette";
import { RouletteWheel } from "./roulette-wheel";

export const DEFAULT_ROULETTE_TITLE = "Nova Roleta";

interface RouletteEditorProps {
  mode: "new" | "edit";
  initialData?: RouletteData;
}

export function RouletteEditor({ mode, initialData }: RouletteEditorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addRoulette, updateRoulette } = useRouletteDb();

  const [title, setTitle] = useState(
    initialData?.title ?? DEFAULT_ROULETTE_TITLE
  );
  const [optionsText, setOptionsText] = useState(
    initialData?.options.join("\n") ?? ""
  );
  const [savedSnapshot, setSavedSnapshot] = useState({
    title: initialData?.title ?? DEFAULT_ROULETTE_TITLE,
    options: initialData?.options ?? [],
    id: initialData?.id,
    createdAt: initialData?.createdAt,
  });

  const [mustSpin, setMustSpin] = useState(false);
  const [prizeIndex, setPrizeIndex] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();

  const options = useMemo(
    () => parseOptionsFromText(optionsText),
    [optionsText]
  );

  const isDirty = useMemo(() => {
    if (mode === "new" && !savedSnapshot.id) {
      return (
        title !== DEFAULT_ROULETTE_TITLE ||
        options.length > 0 ||
        optionsText.trim().length > 0
      );
    }
    return (
      title !== savedSnapshot.title ||
      !optionsEqual(options, savedSnapshot.options)
    );
  }, [mode, title, options, optionsText, savedSnapshot]);

  const handleSave = () => {
    if (!isDirty || isSaving) return;

    const trimmedTitle = title.trim() || DEFAULT_ROULETTE_TITLE;

    startSaveTransition(async () => {
      const now = new Date().toISOString();

      if (mode === "new" && !savedSnapshot.id) {
        const id = v7();
        const data: RouletteData = {
          id,
          title: trimmedTitle,
          options,
          createdAt: now,
          updatedAt: now,
        };
        await addRoulette(data);
        setSavedSnapshot({
          title: trimmedTitle,
          options: [...options],
          id,
          createdAt: now,
        });
        setTitle(trimmedTitle);
        toast.success(
          t("ROULETTE_SAVE_SUCCESS", "Roleta salva com sucesso")
        );
        navigate(`/dashboard/roulette/${id}`, { replace: true });
        return;
      }

      const id = savedSnapshot.id!;
      const data: RouletteData = {
        id,
        title: trimmedTitle,
        options,
        createdAt: savedSnapshot.createdAt ?? now,
        updatedAt: now,
      };
      await updateRoulette(data);
      setSavedSnapshot({
        title: trimmedTitle,
        options: [...options],
        id,
        createdAt: data.createdAt,
      });
      setTitle(trimmedTitle);
      toast.success(t("ROULETTE_SAVE_SUCCESS", "Roleta salva com sucesso"));
    });
  };

  const handleSpin = () => {
    if (mustSpin || resultOpen || options.length === 0) return;
    setWinner(null);
    const index = pickWinnerIndex(options);
    setPrizeIndex(index);
    setMustSpin(true);
  };

  const handleStopSpinning = () => {
    setMustSpin(false);
    const name = options[prizeIndex];
    if (name) {
      setWinner(name);
      setResultOpen(true);
    }
  };

  const heading =
    title.trim() ||
    (mode === "new"
      ? t("ROULETTE_CREATE_TITLE", "Nova Roleta")
      : t("ROULETTE_TITLE", "Roleta"));

  return (
    <div className="flex flex-col gap-4">
      <ShellHeader
        section={t("DASHBOARD_SIDEBAR_SECTION_GIVEAWAYS")}
        page={t("DASHBOARD_SIDEBAR_ITEM_ROULETTE")}
        title={heading}
        description={t("ROULETTE_HEADER_DESCRIPTION")}
        actions={
          <>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate("/dashboard/roulette")}
            >
              <ArrowLeft />
              <span>{t("NAVIGATE_BACK", "Voltar")}</span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleSave}
              disabled={!isDirty || isSaving || mustSpin}
              loading={isSaving}
            >
              <Save />
              {t("ROULETTE_SAVE_BUTTON", "Salvar")}
            </Button>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-[30px] items-center gap-2 rounded-[8px] border border-border bg-[var(--sd-surface-2)] px-2.5 text-[12.5px] font-semibold">
            <span className="font-medium text-muted-foreground">
              {t("ROULETTE_HUD_SLICES")}
            </span>
            <span className="font-mono">{options.length}</span>
          </span>
          <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--sd-local)_22%,transparent)] bg-[var(--sd-local-soft)] px-2.5 text-xs font-semibold text-[var(--sd-local)]">
            <HardDrive className="size-3.5" />
            {t("ROULETTE_LOCAL")}
          </span>
        </div>
      </ShellHeader>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
        <InventoryPanel
          title={t("ROULETTE_ITEMS_PANEL")}
          meta={`${options.length} ${t("ROULETTE_OPTIONS_COUNT", "fatias")}`}
          className="min-h-0"
          bodyClassName="flex flex-col gap-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="roulette-title">
              {t("ROULETTE_TITLE_FIELD", "Título")}
            </Label>
            <Input
              id="roulette-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={DEFAULT_ROULETTE_TITLE}
              disabled={mustSpin}
            />
          </div>

          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="roulette-options">
              {t("ROULETTE_OPTIONS_FIELD", "Opções")}
            </Label>
            <Textarea
              id="roulette-options"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={t(
                "ROULETTE_OPTIONS_PLACEHOLDER",
                "Uma opção por linha\nExemplo:\nAlice\nBob\nCarol"
              )}
              className="min-h-[220px] resize-none font-mono text-sm leading-relaxed"
              disabled={mustSpin}
            />
            <p className="text-xs text-muted-foreground">
              {t(
                "ROULETTE_OPTIONS_HINT",
                "Cada linha vira uma fatia. Remover a linha remove a fatia."
              )}
            </p>
          </div>
        </InventoryPanel>

        <section
          data-roulette-stage
          className="sd-roulette-stage flex min-h-[520px] flex-col rounded-[14px] border border-border p-4 shadow-[var(--sd-shadow-1)] sm:p-6"
        >
          <div className="grid flex-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(200px,240px)]">
            <RouletteWheel
              options={options}
              mustSpin={mustSpin}
              prizeIndex={prizeIndex}
              onStopSpinning={handleStopSpinning}
            />

            <div className="flex flex-col items-start gap-3">
              <p className="text-[13px] font-bold tracking-[0.22em] text-muted-foreground uppercase">
                {mustSpin
                  ? t("ROULETTE_STAGE_SPINNING")
                  : t("ROULETTE_STAGE_READY")}
              </p>
              <p className="font-display text-[40px] leading-none font-extrabold text-foreground">
                {options.length === 1
                  ? t("ROULETTE_STAGE_PRIZES_one", { count: options.length })
                  : t("ROULETTE_STAGE_PRIZES_other", { count: options.length })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("ROULETTE_STAGE_HINT")}
              </p>

              {winner && !resultOpen ? (
                <div data-roulette-last-result className="w-full">
                  <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    {t("ROULETTE_LAST_RESULT")}
                  </p>
                  <p className="mt-1 truncate font-display text-2xl font-extrabold text-foreground">
                    {winner}
                  </p>
                </div>
              ) : null}

              <Button
                variant="drop"
                onClick={handleSpin}
                disabled={options.length === 0 || mustSpin || resultOpen}
              >
                <Dices />
                {mustSpin
                  ? t("ROULETTE_SPINNING", "Girando...")
                  : t("ROULETTE_SPIN_BUTTON", "Girar")}
              </Button>
            </div>
          </div>
        </section>
      </div>

      {resultOpen && winner ? (
        <WinnerMoment
          pendingWinner={{
            id: winner,
            displayName: winner,
            avatar: "",
            subscriber: false,
          }}
          messages={[]}
          giveawayTitle={heading}
          showCancel={false}
          showRedraw={false}
          showChatWait={false}
          confirmLabel={t("ROULETTE_RESULT_CONTINUE")}
          localHint={t("ROULETTE_LOCAL")}
          eyebrow={t("ROULETTE_RESULT_EYEBROW")}
          subtitle={heading}
          onConfirm={() => undefined}
          onDismiss={() => setResultOpen(false)}
          onCancel={() => undefined}
          onRedraw={() => undefined}
          isRedrawing={false}
        />
      ) : null}
    </div>
  );
}
