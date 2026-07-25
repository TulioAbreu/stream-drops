import { useMemo, useState, useTransition } from "react";
import confetti from "canvas-confetti";
import { Save, Dices, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { v7 } from "uuid";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

function fireWinnerConfetti() {
  const count = 180;
  const defaults = { origin: { y: 0.65 } };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      colors: ["#fb923c", "#fbbf24", "#a78bfa", "#22d3ee", "#f472b6"],
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
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
    if (mustSpin || options.length === 0) return;
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
      fireWinnerConfetti();
    }
  };

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden">
      <aside className="order-2 flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 lg:order-1">
        <div className="shrink-0 space-y-1.5">
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

        <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <Label htmlFor="roulette-options">
              {t("ROULETTE_OPTIONS_FIELD", "Opções")}
            </Label>
            <Badge variant="outline" className="font-mono tabular-nums">
              {options.length}{" "}
              {t("ROULETTE_OPTIONS_COUNT", "fatias")}
            </Badge>
          </div>
          <Textarea
            id="roulette-options"
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder={t(
              "ROULETTE_OPTIONS_PLACEHOLDER",
              "Uma opção por linha\nExemplo:\nAlice\nBob\nCarol"
            )}
            className="min-h-[140px] flex-1 resize-none font-mono text-sm leading-relaxed"
            disabled={mustSpin}
          />
          <p className="shrink-0 text-xs text-muted-foreground">
            {t(
              "ROULETTE_OPTIONS_HINT",
              "Cada linha vira uma fatia. Remover a linha remove a fatia."
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving || mustSpin}
            loading={isSaving}
          >
            <Save className="h-4 w-4" />
            {t("ROULETTE_SAVE_BUTTON", "Salvar")}
          </Button>
          <Button
            variant="secondary"
            onClick={handleSpin}
            disabled={options.length === 0 || mustSpin}
            className="lg:hidden"
          >
            <Dices className="h-4 w-4" />
            {mustSpin
              ? t("ROULETTE_SPINNING", "Girando...")
              : t("ROULETTE_SPIN_BUTTON", "Girar")}
          </Button>
        </div>
      </aside>

      <section className="order-1 flex min-h-0 min-w-0 flex-col items-center lg:order-2">
        <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
          <RouletteWheel
            options={options}
            mustSpin={mustSpin}
            prizeIndex={prizeIndex}
            onStopSpinning={handleStopSpinning}
          />
        </div>

        <div className="relative z-20 flex w-full max-w-lg shrink-0 flex-col items-center gap-2 bg-background/80 pb-1 pt-2 backdrop-blur-sm">
          <Button
            size="lg"
            onClick={handleSpin}
            disabled={options.length === 0 || mustSpin}
            className="hidden min-w-[180px] lg:inline-flex"
          >
            <Dices className="h-4 w-4" />
            {mustSpin
              ? t("ROULETTE_SPINNING", "Girando...")
              : t("ROULETTE_SPIN_BUTTON", "Girar")}
          </Button>

          {/* Slot reservado: vencedor não empurra o layout / scroll */}
          <div className="flex h-[4.25rem] w-full items-center">
            {winner ? (
              <div className="winner-conic-frame w-full">
                <div className="relative z-10 flex items-center gap-3 rounded-[calc(var(--radius)+1px)] bg-card px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-300">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("ROULETTE_WINNER_LABEL", "Vencedor")}
                    </p>
                    <p className="truncate text-base font-bold text-foreground">
                      {winner}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
