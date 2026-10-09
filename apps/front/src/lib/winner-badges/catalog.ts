import type { BadgeKind, Rarity } from "./types";

export type CatalogPhase = "mvp" | "later";

/**
 * Textos e ícones seguem a spec do Designer (v0.2 §11).
 * `comeback` e `comeback6` são dois ids (Designer) da mesma
 * família `comeback` (PO): só o nível mais alto aparece.
 * Emoji é o do PO; o glifo que a UI usa é `icon`.
 */
export type CatalogItem = {
  id: string;
  kind: BadgeKind;
  family: string;
  level: number;
  rarity: Rarity;
  name: string;
  shortName: string;
  icon: string;
  emoji: string;
  order: number;
  phase: CatalogPhase;
};

export const BADGE_CATALOG: readonly CatalogItem[] = [
  {
    id: "first_drop",
    kind: "moment",
    family: "first_drop",
    level: 1,
    rarity: "common",
    name: "Primeiro Drop",
    shortName: "1º Drop",
    icon: "first_drop",
    emoji: "🎁",
    order: 0,
    phase: "mvp",
  },
  {
    id: "streak_daily",
    kind: "moment",
    family: "streak_daily",
    level: 2,
    rarity: "uncommon",
    name: "Em chamas",
    shortName: "{count} dias",
    icon: "streak_daily",
    emoji: "🔥",
    order: 1,
    phase: "mvp",
  },
  {
    id: "comeback",
    kind: "moment",
    family: "comeback",
    level: 1,
    rarity: "rare",
    name: "Volta triunfal",
    shortName: "Volta triunfal",
    icon: "comeback",
    emoji: "🔁",
    order: 2,
    phase: "mvp",
  },
  {
    id: "comeback6",
    kind: "moment",
    family: "comeback",
    level: 6,
    rarity: "epic",
    name: "Ressurgiu das cinzas",
    shortName: "Ressurgiu",
    icon: "comeback6",
    emoji: "🐦‍🔥",
    order: 3,
    phase: "mvp",
  },
  {
    id: "double_day",
    kind: "moment",
    family: "multi",
    level: 1,
    rarity: "uncommon",
    name: "Dobradinha",
    shortName: "Dobradinha",
    icon: "double_day",
    emoji: "✌️",
    order: 4,
    phase: "mvp",
  },
  {
    id: "hat_trick_24h",
    kind: "moment",
    family: "multi",
    level: 2,
    rarity: "epic",
    name: "Hat-trick",
    shortName: "Hat-trick",
    icon: "hat_trick_24h",
    emoji: "🎩",
    order: 5,
    phase: "mvp",
  },
  {
    id: "month_regular",
    kind: "moment",
    family: "month_regular",
    level: 1,
    rarity: "rare",
    name: "Freguês do mês",
    shortName: "Freguês",
    icon: "month_regular",
    emoji: "📅",
    order: 6,
    phase: "mvp",
  },
  {
    id: "month_lead",
    kind: "moment",
    family: "month_lead",
    level: 1,
    rarity: "rare",
    name: "Assumiu a liderança do mês",
    shortName: "Líder do mês",
    icon: "month_lead",
    emoji: "📈",
    order: 7,
    phase: "mvp",
  },
  {
    id: "double_kill",
    kind: "moment",
    family: "double_kill",
    level: 1,
    rarity: "epic",
    name: "Double Kill",
    shortName: "Double Kill",
    icon: "double_kill",
    emoji: "⚔️",
    order: 8,
    phase: "mvp",
  },
  {
    id: "loyal_sub",
    kind: "moment",
    family: "loyal_sub",
    level: 6,
    rarity: "uncommon",
    name: "Fiel",
    shortName: "Fiel {count}m",
    icon: "loyal_sub",
    emoji: "🛡️",
    order: 9,
    phase: "mvp",
  },
  {
    id: "gifted_sub",
    kind: "moment",
    family: "gifted_sub",
    level: 1,
    rarity: "uncommon",
    name: "Presente do destino",
    shortName: "Presente",
    icon: "gifted_sub",
    emoji: "🎀",
    order: 10,
    phase: "mvp",
  },
  {
    id: "underdog",
    kind: "moment",
    family: "underdog",
    level: 1,
    rarity: "epic",
    name: "Azarão",
    shortName: "Azarão",
    icon: "underdog",
    emoji: "🐢",
    order: 11,
    phase: "later",
  },
  {
    id: "drought_end",
    kind: "moment",
    family: "drought_end",
    level: 5,
    rarity: "rare",
    name: "Fim da seca",
    shortName: "Fim da seca",
    icon: "drought_end",
    emoji: "🌵",
    order: 12,
    phase: "later",
  },
  {
    id: "last_second",
    kind: "moment",
    family: "last_second",
    level: 1,
    rarity: "rare",
    name: "No apagar das luzes",
    shortName: "Última hora",
    icon: "last_second",
    emoji: "⏱️",
    order: 13,
    phase: "later",
  },
  {
    id: "lucky_3",
    kind: "achievement",
    family: "lucky",
    level: 3,
    rarity: "uncommon",
    name: "Sortudo",
    shortName: "Sortudo",
    icon: "lucky_3",
    emoji: "🍀",
    order: 14,
    phase: "mvp",
  },
  {
    id: "lucky_5",
    kind: "achievement",
    family: "lucky",
    level: 5,
    rarity: "rare",
    name: "Pé-quente",
    shortName: "Pé-quente",
    icon: "lucky_5",
    emoji: "🍀",
    order: 15,
    phase: "mvp",
  },
  {
    id: "lucky_10",
    kind: "achievement",
    family: "lucky",
    level: 10,
    rarity: "epic",
    name: "Trevo de 4 folhas",
    shortName: "Trevo",
    icon: "lucky_10",
    emoji: "🍀",
    order: 16,
    phase: "mvp",
  },
  {
    id: "lucky_25",
    kind: "achievement",
    family: "lucky",
    level: 25,
    rarity: "legendary",
    name: "Lenda do Baú",
    shortName: "Lenda do Baú",
    icon: "lucky_25",
    emoji: "🍀",
    order: 17,
    phase: "mvp",
  },
  {
    id: "collector",
    kind: "achievement",
    family: "collector",
    level: 1,
    rarity: "epic",
    name: "Colecionador",
    shortName: "Colecionador",
    icon: "collector",
    emoji: "🧩",
    order: 18,
    phase: "mvp",
  },
  {
    id: "month_king",
    kind: "achievement",
    family: "month_king",
    level: 1,
    rarity: "rare",
    name: "Rei do mês",
    shortName: "Rei do mês",
    icon: "month_king",
    emoji: "👑",
    order: 19,
    phase: "mvp",
  },
  {
    id: "eternal_flame",
    kind: "achievement",
    family: "eternal_flame",
    level: 7,
    rarity: "legendary",
    name: "Chama eterna",
    shortName: "Chama eterna",
    icon: "eternal_flame",
    emoji: "🔥",
    order: 20,
    phase: "mvp",
  },
  {
    id: "phoenix",
    kind: "achievement",
    family: "phoenix",
    level: 6,
    rarity: "epic",
    name: "Fênix",
    shortName: "Fênix",
    icon: "phoenix",
    emoji: "🐦‍🔥",
    order: 21,
    phase: "mvp",
  },
  {
    id: "roulette_exec",
    kind: "achievement",
    family: "roulette_exec",
    level: 1,
    rarity: "rare",
    name: "Carrasco da roleta",
    shortName: "Carrasco",
    icon: "roulette_exec",
    emoji: "🎯",
    order: 22,
    phase: "later",
  },
];

const byId = new Map(BADGE_CATALOG.map((item) => [item.id, item]));

export function getCatalogItem(id: string): CatalogItem | undefined {
  return byId.get(id);
}

export function rarityRank(rarity: Rarity): number {
  switch (rarity) {
    case "common":
      return 0;
    case "uncommon":
      return 1;
    case "rare":
      return 2;
    case "epic":
      return 3;
    case "legendary":
      return 4;
  }
}
