import { useEffect } from "react";
import { useNavigate } from "react-router";

/**
 * Sorteio ausente ou soft-deleted: a mesma saída de "não encontrado"
 * que a página já usava quando o id não existia.
 */
export function useRedirectWhenMissing(missing: boolean, to: string) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!missing) return;
    navigate(to);
  }, [missing, navigate, to]);
}
