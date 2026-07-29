import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";
import type { OverlayStyle } from "@stream-drops/subathon-protocol";
import { Bot, Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  applyOverlayStylePreview,
  formatTimerHms,
  normalizeOverlayStyle,
} from "../utils";

interface OverlayStyleSettingsProps {
  styleDraft: OverlayStyle;
  timerPreviewMs: number;
  dirty: boolean;
  saving: boolean;
  disabled: boolean;
  onChange: (style: OverlayStyle) => void;
  onSave: () => void;
}

export function OverlayStyleSettings({
  styleDraft,
  timerPreviewMs,
  dirty,
  saving,
  disabled,
  onChange,
  onSave,
}: OverlayStyleSettingsProps) {
  const { t } = useTranslation();
  const [promptCopied, setPromptCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const normalized = normalizeOverlayStyle(styleDraft);
  const aiPrompt = t("SUBATHON_STYLE_AI_PROMPT");

  useEffect(() => {
    const host = previewRef.current;
    if (!host) {
      return;
    }

    applyOverlayStylePreview(host, styleDraft);

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const baseStyle = document.createElement("style");
    baseStyle.textContent = `
      :host { display: block; overflow: hidden; border-radius: 0.375rem; }
      .subathon-overlay-root {
        box-sizing: border-box;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 7rem;
        width: 100%;
        padding: 1rem;
        color: var(--subathon-text, #ffffff);
        background: var(--subathon-bg, transparent);
        backdrop-filter: blur(var(--subathon-blur, 0px));
        font-family: var(--subathon-font, monospace);
      }
      .subathon-overlay-timer {
        font-size: 2.25rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        line-height: 1;
        text-shadow: 0 2px 16px rgba(0, 0, 0, 0.45);
      }
      .subathon-overlay-status {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        gap: 8px;
      }
      .subathon-status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .subathon-status-dot-connected { background: #22c55e; }
    `;

    const customStyle = document.createElement("style");
    customStyle.textContent = normalized.customCss;

    const root = document.createElement("div");
    root.className = "subathon-overlay-root";

    const status = document.createElement("div");
    status.className = "subathon-overlay-status";

    const statusDot = document.createElement("span");
    statusDot.className =
      "subathon-status-dot subathon-status-dot-connected";
    status.appendChild(statusDot);

    const timer = document.createElement("div");
    timer.className = "subathon-overlay-timer";
    timer.textContent = formatTimerHms(timerPreviewMs);

    root.append(status, timer);
    shadow.replaceChildren(baseStyle, customStyle, root);
  }, [normalized.customCss, styleDraft, timerPreviewMs]);

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(aiPrompt);
    setPromptCopied(true);
    toast.success(t("SUBATHON_STYLE_AI_COPY_SUCCESS"));
    window.setTimeout(() => setPromptCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("SUBATHON_STYLE_TITLE")}</CardTitle>
        <CardDescription>{t("SUBATHON_STYLE_DESCRIPTION")}</CardDescription>
        <CardAction>
          <Dialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 p-2"
                    aria-label={t("SUBATHON_STYLE_AI_TOOLTIP")}
                  >
                    <Bot className="size-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                {t("SUBATHON_STYLE_AI_TOOLTIP")}
              </TooltipContent>
            </Tooltip>

            <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("SUBATHON_STYLE_AI_TITLE")}</DialogTitle>
                <DialogDescription>
                  {t("SUBATHON_STYLE_AI_DESCRIPTION")}
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={aiPrompt}
                readOnly
                className="h-[min(24rem,50dvh)] min-h-0 resize-none overflow-y-auto field-sizing-fixed font-mono text-xs"
              />
              <DialogFooter>
                <Button type="button" onClick={handleCopyPrompt}>
                  {promptCopied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {promptCopied
                    ? t("SUBATHON_STYLE_AI_COPIED")
                    : t("SUBATHON_STYLE_AI_COPY")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="overlay-custom-css">
            {t("SUBATHON_STYLE_CUSTOM_CSS")}
          </Label>
          <Textarea
            id="overlay-custom-css"
            value={normalized.customCss}
            disabled={disabled}
            className="min-h-48 font-mono text-sm"
            placeholder={t("SUBATHON_STYLE_CUSTOM_CSS_PLACEHOLDER")}
            onChange={(event) =>
              onChange({ ...styleDraft, customCss: event.target.value })
            }
          />
        </div>

        <div className="grid gap-2">
          <Label>{t("SUBATHON_STYLE_PREVIEW")}</Label>
          <div
            ref={previewRef}
            className="min-h-28 rounded-md border"
          />
        </div>

        <Button onClick={onSave} disabled={disabled || !dirty || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("SUBATHON_SAVE")}
        </Button>
      </CardContent>
    </Card>
  );
}
