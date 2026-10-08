export function rankWinnersByDrawOrder<
  T extends { id: string; drawnAt: string },
>(winners: T[]): Map<string, number> {
  const ranked = winners
    .map((winner, index) => ({ winner, index }))
    .sort((a, b) => {
      const timeDiff =
        new Date(a.winner.drawnAt).getTime() -
        new Date(b.winner.drawnAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.index - b.index;
    });

  return new Map(
    ranked.map((item, rankIndex) => [item.winner.id, rankIndex + 1])
  );
}

/**
 * Inverte só a exibição de Subscribers (prepend salvo → cronológico).
 * Não muta o array original.
 */
export function reverseWinnersForDisplay<T>(winners: readonly T[]): T[] {
  return [...winners].reverse();
}

/**
 * Ordena vencedores em ordem cronológica (asc por drawnAt).
 * Desempate pelo índice original (mesma regra do rank).
 */
export function sortWinnersByDrawOrder<T extends { drawnAt: string }>(
  winners: T[]
): T[] {
  return winners
    .map((winner, index) => ({ winner, index }))
    .sort((a, b) => {
      const timeDiff =
        new Date(a.winner.drawnAt).getTime() -
        new Date(b.winner.drawnAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.index - b.index;
    })
    .map((item) => item.winner);
}
