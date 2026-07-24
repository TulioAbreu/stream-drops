import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useRouletteDb, type RouletteData } from "@/database/Roulette";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { RouletteEditor } from "../components/roulette-editor";

export function RouletteDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { getRoulette } = useRouletteDb();

  const [roulette, setRoulette] = useState<RouletteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate("/dashboard/roulette", { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      const data = await getRoulette(id);
      if (cancelled) return;

      if (!data) {
        navigate("/dashboard/roulette", { replace: true });
        return;
      }

      setRoulette(data);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !roulette) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

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
        <h1 className="text-2xl font-bold truncate">
          {roulette.title || t("ROULETTE_TITLE", "Roleta")}
        </h1>
      </div>
      <RouletteEditor mode="edit" initialData={roulette} />
    </Layout>
  );
}
