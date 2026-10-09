import { useExclusionListDb } from "@/database/ExclusionListItem";
import { useCallback, useEffect, useRef, useState } from "react";

function sameStringSet(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

/**
 * Lê a exclusion-list ao montar, quando a aba volta a ficar visível
 * e quando o chamador pede de novo (logo antes do sorteio).
 * Só leitura: não grava a lista nem os participantes.
 */
export function useLiveExclusions() {
  const { getExclusions } = useExclusionListDb();
  const getExclusionsRef = useRef(getExclusions);
  getExclusionsRef.current = getExclusions;

  const [excludedUserIds, setExcludedUserIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const refreshExclusions = useCallback(async () => {
    const exclusions = await getExclusionsRef.current();
    const next = new Set(exclusions.map((item) => item.twitchUserId));
    setExcludedUserIds((current) =>
      sameStringSet(current, next) ? current : next,
    );
    return next;
  }, []);

  useEffect(() => {
    void refreshExclusions();
  }, [refreshExclusions]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshExclusions();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshExclusions]);

  return { excludedUserIds, refreshExclusions };
}
