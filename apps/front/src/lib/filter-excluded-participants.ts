/**
 * Filtro de leitura. Não altera o array salvo: quem está na
 * exclusion-list some da lista, das contagens e do sorteio.
 */
export function filterExcludedByUserId<T>(
  items: readonly T[],
  excludedUserIds: Iterable<string>,
  getUserId: (item: T) => string,
): T[] {
  const excluded =
    excludedUserIds instanceof Set
      ? excludedUserIds
      : new Set(excludedUserIds);

  if (excluded.size === 0) {
    return [...items];
  }

  return items.filter((item) => !excluded.has(getUserId(item)));
}
