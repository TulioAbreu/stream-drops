import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { getSubathonOverlayUrl } from "@/pages/subathon-overlay";
import { ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSubathon } from "../hooks/use-subathon";

export function OverlayUrlActions() {
  const { t } = useTranslation();
  const subathon = useSubathon();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const copyOverlayUrl = async () => {
    const url = getSubathonOverlayUrl();
    await navigator.clipboard.writeText(url);
    toast.success(t("SUBATHON_COPY_OVERLAY_SUCCESS"));
  };

  const copyServerOverlayUrl = async () => {
    if (!subathon.overlayUrl) {
      return;
    }

    await navigator.clipboard.writeText(subathon.overlayUrl);
    toast.success(t("SUBATHON_COPY_SERVER_OVERLAY_SUCCESS"));
  };

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <Button variant="outline" onClick={() => void copyOverlayUrl()}>
        <Copy className="size-4" />
        {t("SUBATHON_COPY_OVERLAY")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        aria-expanded={advancedOpen}
        onClick={() => setAdvancedOpen((open) => !open)}
      >
        {t("SUBATHON_OVERLAY_ADVANCED")}
        <ChevronDown
          className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
        />
      </Button>
      {advancedOpen ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copyServerOverlayUrl()}
          disabled={!subathon.overlayUrl}
        >
          <Copy className="size-4" />
          {t("SUBATHON_COPY_SERVER_OVERLAY")}
        </Button>
      ) : null}
    </div>
  );
}
