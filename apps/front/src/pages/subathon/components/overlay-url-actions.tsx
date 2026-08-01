import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { getSubathonOverlayUrl } from "@/pages/subathon-overlay";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export function OverlayUrlActions() {
  const { t } = useTranslation();

  const copyOverlayUrl = async () => {
    const url = getSubathonOverlayUrl();
    await navigator.clipboard.writeText(url);
    toast.success(t("SUBATHON_COPY_OVERLAY_SUCCESS"));
  };

  return (
    <Button variant="outline" onClick={() => void copyOverlayUrl()}>
      <Copy className="size-4" />
      {t("SUBATHON_COPY_OVERLAY")}
    </Button>
  );
}
