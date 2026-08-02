import type { DonationBotConfig } from "./types";

export const DEFAULT_DONATION_BOT_CONFIG: DonationBotConfig = {
  enabled: false,
  botUsername: "",
  templates: [],
};

export interface DonationMatch {
  user: string;
  amount: number;
}

/**
 * Parse a money amount from bot chat text.
 * - Both `.` and `,`: last separator is decimal
 * - Single separator + 1–2 digits after → decimal
 * - Single separator + 3 digits after → thousands grouping
 * - Digits only → integer
 */
export function parseMoneyAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "");
  if (!cleaned || !/^[\d.,]+$/.test(cleaned)) {
    return null;
  }

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  let normalized: string;

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    if (lastComma > lastDot) {
      // 1.000,50 → BR
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,000.50 → US
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasDot || hasComma) {
    const sep = hasDot ? "." : ",";
    const parts = cleaned.split(sep);
    if (parts.length === 2) {
      const fraction = parts[1] ?? "";
      if (fraction.length === 3) {
        // thousands: 1.000 / 1,000
        normalized = parts.join("");
      } else if (fraction.length <= 2) {
        // decimal: 10.40 / 10,40
        normalized = `${parts[0]}.${fraction}`;
      } else {
        return null;
      }
    } else if (parts.length > 2) {
      // chained thousands: 1.000.000
      const last = parts[parts.length - 1] ?? "";
      if (last.length === 3 && parts.every((p, i) =>
        i === 0 ? /^\d+$/.test(p) : p.length === 3 && /^\d+$/.test(p),
      )) {
        normalized = parts.join("");
      } else {
        return null;
      }
    } else {
      return null;
    }
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match a single template against a chat message.
 * Placeholders: `{user}` (non-greedy), `{amount}` (digits / . / ,).
 */
export function matchDonationTemplate(
  template: string,
  message: string,
): DonationMatch | null {
  const trimmedTemplate = template.trim();
  if (!trimmedTemplate) {
    return null;
  }

  const tokenPattern = /\{(user|amount)\}/g;
  let pattern = "^";
  let lastIndex = 0;
  const groupOrder: Array<"user" | "amount"> = [];
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(trimmedTemplate)) !== null) {
    pattern += escapeRegex(
      trimmedTemplate.slice(lastIndex, match.index),
    );
    const token = match[1] as "user" | "amount";
    groupOrder.push(token);
    if (token === "user") {
      pattern += "(.+?)";
    } else {
      pattern += "([\\d.,]+)";
    }
    lastIndex = match.index + match[0].length;
  }

  pattern += escapeRegex(trimmedTemplate.slice(lastIndex));
  pattern += "$";

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "i");
  } catch {
    return null;
  }

  const result = regex.exec(message.trim());
  if (!result) {
    return null;
  }

  let user = "";
  let amountRaw = "";

  for (let i = 0; i < groupOrder.length; i++) {
    const captured = result[i + 1] ?? "";
    if (groupOrder[i] === "user") {
      user = captured.trim();
    } else {
      amountRaw = captured.trim();
    }
  }

  if (!user || !amountRaw) {
    return null;
  }

  const amount = parseMoneyAmount(amountRaw);
  if (amount === null || amount <= 0) {
    return null;
  }

  return { user, amount };
}

/** Try templates in order; return the first match. */
export function matchDonationMessage(
  templates: string[],
  message: string,
): DonationMatch | null {
  for (const template of templates) {
    const matched = matchDonationTemplate(template, message);
    if (matched) {
      return matched;
    }
  }
  return null;
}

export function normalizeDonationBotConfig(
  raw: unknown,
): DonationBotConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_DONATION_BOT_CONFIG };
  }

  const obj = raw as Record<string, unknown>;
  const templates = Array.isArray(obj.templates)
    ? obj.templates.filter((t): t is string => typeof t === "string")
    : [];

  return {
    enabled: Boolean(obj.enabled),
    botUsername:
      typeof obj.botUsername === "string" ? obj.botUsername.trim() : "",
    templates,
  };
}
