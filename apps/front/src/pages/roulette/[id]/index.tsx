import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useRouletteDb, type RouletteData } from "@/database/Roulette";
import { useNavigate, useParams } from "react-router";
import { RouletteEditor } from "../components/roulette-editor";

export function RouletteDetailPage() {
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
      <RouletteEditor mode="edit" initialData={roulette} />
    </Layout>
  );
}
