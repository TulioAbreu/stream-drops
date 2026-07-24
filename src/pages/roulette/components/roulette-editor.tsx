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
import { cn } from "@/lib/utils";

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
    <div className="grid gap-8 lg:grid-cols-[minmax(280px,380px)_1fr]">
      <aside className="flex flex-col gap-5">
        <div className="space-y-2">
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

        <div className="flex flex-1 flex-col space-y-2">
          <div className="flex items-center justify-between gap-2">
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
            className="min-h-[280px] flex-1 resize-y font-mono text-sm leading-relaxed"
            disabled={mustSpin}
          />
          <p className="text-xs text-muted-foreground">
            {t(
              "ROULETTE_OPTIONS_HINT",
              "Cada linha vira uma fatia. Remover a linha remove a fatia."
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
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
          >
            <Dices className="h-4 w-4" />
            {mustSpin
              ? t("ROULETTE_SPINNING", "Girando...")
              : t("ROULETTE_SPIN_BUTTON", "Girar")}
          </Button>
        </div>
      </aside>

      <section className="flex flex-col items-center justify-center gap-6">
        <RouletteWheel
          options={options}
          mustSpin={mustSpin}
          prizeIndex={prizeIndex}
          onStopSpinning={handleStopSpinning}
        />

        <div
          className={cn(
            "w-full max-w-md transition-all duration-300",
            winner ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          )}
        >
          {winner && (
            <div className="winner-conic-frame">
              <div className="relative z-10 flex items-center gap-3 rounded-[calc(var(--radius)+1px)] bg-card px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20 text-violet-300">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("ROULETTE_WINNER_LABEL", "Vencedor")}
                  </p>
                  <p className="truncate text-lg font-bold text-foreground">
                    {winner}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
