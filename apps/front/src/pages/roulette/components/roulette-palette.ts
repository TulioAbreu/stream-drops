/** Fatias na ordem dos tokens do DS. O canvas não lê var() — resolvemos na hora. */
export const SLICE_TOKENS = [
  "--primary",
  "--sd-brand-orange",
  "--rarity-rare",
  "--rarity-epic",
  "--rarity-uncommon",
  "--chart-4",
  "--sd-brand-cream",
  "--rarity-legendary",
] as const;

export const TEXT_TOKENS = [
  "--primary-foreground",
  "--foreground",
  "--background",
  "--card",
] as const;

export function readToken(name: string): string {
  const specified = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!specified) return "";
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

export function parseCssColor(input: string): [number, number, number] | null {
  const value = input.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((char) => char + char)
            .join("")
        : hex;
    if (full.length !== 6) return null;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => parseFloat(part.trim()));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return [parts[0], parts[1], parts[2]];
}

function luminance(color: string): number | null {
  const rgb = parseCssColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(background: string, foreground: string): number {
  const back = luminance(background);
  const front = luminance(foreground);
  if (back == null || front == null) return 0;
  const lighter = Math.max(back, front);
  const darker = Math.min(back, front);
  return (lighter + 0.05) / (darker + 0.05);
}

export function inkFor(background: string, candidates: string[]): string {
  let best = candidates[0] ?? background;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = contrast(background, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function mix(base: string, toward: string, keep: number): string {
  const from = parseCssColor(base);
  const to = parseCssColor(toward);
  if (!from || !to) return base;
  const channel = (index: number) =>
    Math.round(from[index] * keep + to[index] * (1 - keep));
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/**
 * Garante AA (4.5:1) misturando a fatia com outra cor de token
 * quando o par original fica curto.
 */
export function slicePaint(
  fill: string,
  inks: string[],
): { background: string; text: string } {
  let background = fill;
  let text = inkFor(background, inks);
  let guard = 0;
  while (contrast(background, text) < 4.5 && guard < 10) {
    const textLum = luminance(text) ?? 1;
    const anchor = [...inks].sort((a, b) => {
      const lumA = luminance(a) ?? 0;
      const lumB = luminance(b) ?? 0;
      return textLum > 0.5 ? lumA - lumB : lumB - lumA;
    })[0];
    if (!anchor) break;
    background = mix(background, anchor, 0.8);
    text = inkFor(background, inks);
    guard += 1;
  }
  return { background, text };
}

export function pointerSrc(fill: string, stroke: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M32 58 L8 10 L56 10 Z" fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
