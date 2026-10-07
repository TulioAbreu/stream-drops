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
