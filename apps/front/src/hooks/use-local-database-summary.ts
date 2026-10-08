import { useEffect, useState } from "react";
import {
  readLocalDatabaseSummary,
  subscribeLocalDatabase,
  type LocalDatabaseSummary,
} from "@/database/local-database-summary";

export function useLocalDatabaseSummary(): LocalDatabaseSummary | null {
  const [summary, setSummary] = useState<LocalDatabaseSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    let request = 0;

    const load = () => {
      const id = ++request;
      readLocalDatabaseSummary()
        .then((next) => {
          if (!cancelled && id === request) setSummary(next);
        })
        .catch((error) => {
          console.error("Erro ao ler o baú deste navegador:", error);
        });
    };

    load();
    const unsubscribe = subscribeLocalDatabase(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return summary;
}
