import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { RouletteEditor } from "../components/roulette-editor";

export function RouletteNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard/roulette")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">
          {t("ROULETTE_CREATE_TITLE", "Nova Roleta")}
        </h1>
      </div>
      <RouletteEditor mode="new" />
    </Layout>
  );
}
