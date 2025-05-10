import { ptBRT } from "./pt-BR";

// TODO: check a lib for this

export type I18n = Record<
    typeof I18NKeys[number],
    string
>;

export const I18nLanguages = {
    PT_BR: 'pt-BR',
} as const;

export type I18nLanguages = typeof I18nLanguages[keyof typeof I18nLanguages];

export const I18NKeys = [
    "LOGIN_TITLE",
    "LOGIN_BUTTON_TWITCH",
    "DASHBOARD_SIDEBAR_ITEM_FOLLOWER_GIVEAWAY",
    "DASHBOARD_SIDEBAR_ITEM_TICKET_GIVEAWAY",
    "FOLLOWER_GIVEAWAY_TITLE",
    "FOLLOWER_GIVEAWAY_DESCRIPTION",
] as const;

export const T = ptBRT;
