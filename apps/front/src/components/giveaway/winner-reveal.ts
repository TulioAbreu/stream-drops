import type { PendingWinnerInfo } from "./types";

export type DropRarity = "common" | "rare" | "epic" | "legendary";

type EaseName = "standard" | "exit" | "drop" | "linear" | "idle";
type MotionValue = string | Record<string, string | number>;
type RevealFrame = [number, MotionValue, EaseName?];

interface Intensity {
  shakeN: number;
  shakeDeg: number;
  conf: number;
  burst: number;
  halo: boolean;
  shine: boolean;
  rays: boolean;
  veil: boolean;
  hops: number;
  sparkle: boolean;
}

const EASE: Record<EaseName, string> = {
  standard: "cubic-bezier(.2, .8, .2, 1)",
  exit: "cubic-bezier(.4, 0, 1, 1)",
  drop: "cubic-bezier(.34, 1.56, .64, 1)",
  linear: "linear",
  idle: "cubic-bezier(.45, 0, .55, 1)",
};

const INT: Record<DropRarity, Intensity> = {
  common: {
    shakeN: 2,
    shakeDeg: 2,
    conf: 14,
    burst: 0,
    halo: false,
    shine: false,
    rays: false,
    veil: false,
    hops: 1,
    sparkle: false,
  },
  rare: {
    shakeN: 3,
    shakeDeg: 2,
    conf: 26,
    burst: 0,
    halo: true,
    shine: false,
    rays: false,
    veil: false,
    hops: 2,
    sparkle: false,
  },
  epic: {
    shakeN: 3,
    shakeDeg: 3,
    conf: 32,
    burst: 0,
    halo: true,
    shine: true,
    rays: false,
    veil: false,
    hops: 2,
    sparkle: true,
  },
  legendary: {
    shakeN: 4,
    shakeDeg: 3,
    conf: 40,
    burst: 16,
    halo: true,
    shine: false,
    rays: true,
    veil: true,
    hops: 3,
    sparkle: true,
  },
};

const ARM = {
  L: { rest: "rotate(0deg)", up: "rotate(124deg)" },
  R: { rest: "rotate(117deg)", up: "rotate(-8deg)", wave: "rotate(0deg)" },
};

const LID = {
  closed: "translate(0px, 7px) rotate(0deg)",
  rest: "translate(0px, 0px) rotate(-4deg)",
  open: "translate(0px, -1.5px) rotate(-14deg)",
  pop: "translate(0px, -6px) rotate(-28deg)",
};

const CONFETTI_CAP = 56;
const HOME = "translate(0px, 0px) scale(1)";

export interface NameFit {
  size: number;
  trunc: boolean;
  max: number;
  peak: number;
}

export function dropRarity(
  tier: PendingWinnerInfo["tier"],
): DropRarity {
  if (tier === 3000) return "legendary";
  if (tier === 2000) return "epic";
  if (tier === 1000) return "rare";
  return "common";
}

/** Instante em que a tampa estoura e o nome entra. */
export function nameAt(rarity: DropRarity): number {
  return 280 + INT[rarity].shakeN * 110;
}

export function applyNameFit(stage: HTMLElement): NameFit {
  const nameEl = stage.querySelector<HTMLElement>(".sd-winner-name");
  const textEl = stage.querySelector<HTMLElement>(".sd-winner-name-text");
  const fallback: NameFit = { size: 112, trunc: false, max: 0, peak: 1.18 };
  if (!nameEl || !textEl) return fallback;
  const stageWidth = stage.clientWidth || 1920;
  const avail = stageWidth - stageWidth * 0.1;
  nameEl.style.fontSize = "112px";
  nameEl.style.maxWidth = "none";
  const natural = textEl.offsetWidth;
  if (natural <= 0) return fallback;
  let size = Math.min(112, Math.floor((112 * avail) / natural));
  const trunc = size < 64;
  if (trunc) size = 64;
  nameEl.style.fontSize = `${size}px`;
  const settled = Math.min(textEl.offsetWidth, avail);
  const peak = Math.min(
    1.18,
    Number(((stageWidth - 48) / Math.max(settled, 1)).toFixed(3)),
  );
  return { size, trunc, max: trunc ? avail : 0, peak };
}

interface PlayOptions {
  rarity: DropRarity;
  reduced: boolean;
  peak: number;
}

export function playWinnerReveal(
  stage: HTMLElement,
  options: PlayOptions,
): () => void {
  const animations: Animation[] = [];
  const timers: number[] = [];
  const fx = stage.querySelector<HTMLElement>("[data-reveal='fx']");

  const track = (el: Element | null, frames: RevealFrame[]): Animation | null => {
    if (!el || frames.length === 0) return null;
    const sequence = frames.map((frame) => [...frame] as RevealFrame);
    if (sequence[0][0] > 0) sequence.unshift([0, sequence[0][1]]);
    const end = Math.max(1, sequence[sequence.length - 1][0]);
    const keyframes: Keyframe[] = sequence.map(([time, props], index) => {
      const next = sequence[index + 1];
      const value = typeof props === "string" ? { transform: props } : props;
      return {
        ...value,
        offset: Math.min(1, time / end),
        easing: next?.[2] ? EASE[next[2]] : "linear",
      };
    });
    const animation = el.animate(keyframes, {
      duration: end,
      fill: "both",
    });
    animations.push(animation);
    return animation;
  };

  const fade = (
    el: Element | null,
    start: number,
    duration: number,
    to = 1,
  ) => {
    track(el, [
      [start, { opacity: 0 }],
      [start + duration, { opacity: to }, "standard"],
    ]);
  };

  if (options.reduced) playReduced(stage, fade);
  else playFull(stage, options, track, fade, timers, animations);

  return () => {
    for (const animation of animations) animation.cancel();
    for (const timer of timers) window.clearTimeout(timer);
    fx?.replaceChildren();
    stage.querySelectorAll<HTMLElement>(".sd-winner-beam").forEach((beam) => {
      beam.style.animation = "";
    });
    const gems = stage.querySelector<HTMLElement>("[data-reveal='gems']");
    if (gems) gems.style.visibility = "";
  };
}

function playReduced(
  stage: HTMLElement,
  fade: (el: Element | null, start: number, duration: number, to?: number) => void,
) {
  place(stage);
  const q = (name: string) =>
    stage.querySelector<HTMLElement>(`[data-reveal='${name}']`);
  fade(q("top"), 0, 200);
  fade(q("bg"), 0, 200);
  const beams = stage.querySelectorAll<HTMLElement>(".sd-winner-beam");
  fade(beams[0] ?? null, 0, 200, 1);
  fade(beams[1] ?? null, 0, 200, 0.7);
  fade(q("gems"), 0, 200);
  fade(q("back"), 0, 200);
  fade(q("avatar"), 0, 200);
  fade(q("slot"), 0, 200);
  const bottom = stage.querySelector("[data-winner-bottom]");
  if (!bottom) return;
  const pill = bottom.querySelector(":scope > p.border-dashed");
  const buttons = bottom.querySelector(":scope > div.flex-wrap");
  const local = bottom.querySelector(":scope > p.text-xs");
  for (const el of [pill, buttons, local]) fade(el, 120, 120);
}

function playFull(
  stage: HTMLElement,
  options: PlayOptions,
  track: (el: Element | null, frames: RevealFrame[]) => Animation | null,
  fade: (el: Element | null, start: number, duration: number, to?: number) => void,
  timers: number[],
  animations: Animation[],
) {
  const rarity = options.rarity;
  const intensity = INT[rarity];
  const q = (name: string) =>
    stage.querySelector<HTMLElement>(`[data-reveal='${name}']`);
  const chest = stage.querySelector(".sd-chest");
  const part = (selector: string) => chest?.querySelector(selector) ?? null;
  const placed = place(stage);
  const gems = q("gems");
  if (gems) gems.style.visibility = "visible";

  const burst = nameAt(rarity);
  const moment = placed.moment;
  fade(q("bg"), 0, 320);

  const shake: RevealFrame[] = [[280, "rotate(0deg)"]];
  for (let hop = 0; hop < intensity.shakeN; hop += 1) {
    const at = 280 + hop * 110;
    shake.push(
      [at + 27, `rotate(${-intensity.shakeDeg}deg)`, "idle"],
      [at + 82, `rotate(${intensity.shakeDeg}deg)`, "idle"],
      [at + 110, "rotate(0deg)", "idle"],
    );
  }
  track(q("shake"), shake);

  if (intensity.veil) {
    track(q("veil"), [
      [0, { opacity: 0 }],
      [200, { opacity: 0.55 }, "standard"],
      [burst, { opacity: 0.55 }],
      [burst + 320, { opacity: 0 }, "exit"],
    ]);
  }

  track(part(".b-lid"), [
    [0, LID.closed],
    [burst, LID.closed],
    [burst + 320, LID.pop, "drop"],
    [burst + 520, LID.open, "standard"],
    [burst + 600, LID.open],
    [burst + 780, LID.rest, "standard"],
  ]);
  track(part(".b-glow"), [
    [burst, { opacity: 0 }],
    [burst + 200, { opacity: 1 }, "standard"],
    [burst + 600, { opacity: 1 }],
    [burst + 780, { opacity: 0 }, "standard"],
  ]);

  track(q("eyebrow"), [
    [burst, { opacity: 0, transform: "translateY(8px)" }],
    [burst + 200, { opacity: 1, transform: "none" }, "standard"],
  ]);
  track(q("name"), [
    [burst, { opacity: 0, transform: "translateY(36px) scale(.6)" }],
    [
      burst + 160,
      {
        opacity: 1,
        transform: `translateY(-10px) scale(${options.peak})`,
      },
      "drop",
    ],
    [burst + 460, { opacity: 1, transform: "none" }, "standard"],
  ]);
  track(q("subtitle"), [
    [burst + 220, { opacity: 0 }],
    [burst + 420, { opacity: 1 }, "standard"],
  ]);

  const body: RevealFrame[] = [
    [0, { opacity: 0, transform: "translateY(30px) scale(.92)" }],
    [320, { opacity: 1, transform: "none" }, "drop"],
  ];
  for (let hop = 0; hop < intensity.hops; hop += 1) {
    const at = burst + 180 + hop * 200;
    body.push(
      [at, { opacity: 1, transform: "none" }],
      [at + 80, { opacity: 1, transform: "translateY(-10px) scale(.98,1.03)" }, "standard"],
      [at + 200, { opacity: 1, transform: "none" }, "drop"],
    );
  }
  track(part(".b-all"), body);

  track(part(".b-eyes"), [
    [burst + 80, "scale(1.25)"],
    [burst + 400, "scale(1)", "drop"],
  ]);
  track(part(".b-pup"), [
    [burst + 300, "translate(0px, 0px)"],
    [burst + 500, "translate(0px, -1.3px)", "standard"],
    [burst + 600, "translate(0px, -1.3px)"],
    [burst + 780, "translate(0px, 0px)", "standard"],
  ]);

  const armsAt = burst + 200;
  track(part(".b-armL"), [
    [0, ARM.L.rest],
    [armsAt, ARM.L.rest],
    [armsAt + 320, ARM.L.up, "drop"],
    [armsAt + 360, ARM.L.up],
    [armsAt + 580, ARM.L.rest, "standard"],
  ]);
  track(part(".b-wave"), [
    [0, ARM.R.rest],
    [armsAt, ARM.R.rest],
    [armsAt + 320, ARM.R.up, "drop"],
    [armsAt + 360, ARM.R.up],
    [armsAt + 580, ARM.R.wave, "standard"],
  ]);

  const travel = (120 * placed.scale).toFixed(1);
  const inside = `translateY(${travel}px) scale(.35) rotate(-14deg)`;
  track(q("gem-move"), [
    [0, { opacity: 0, transform: inside }],
    [320, { opacity: 1, transform: inside }, "drop"],
    [burst + 40, { opacity: 1, transform: inside }],
    [burst + 740, { opacity: 1, transform: "translateY(0px) scale(1) rotate(0deg)" }, "drop"],
  ]);

  if (intensity.halo) {
    track(q("halo"), [
      [burst + 200, { opacity: 0, transform: "scale(.6)" }],
      [burst + 520, { opacity: 1, transform: "scale(1)" }, "standard"],
    ]);
  }
  if (intensity.sparkle) {
    const sparks = [
      ...stage.querySelectorAll<HTMLElement>("[data-reveal='spark']"),
    ];
    sparks.forEach((spark, index) => {
      const at = burst + 400 + index * 60;
      track(spark, [
        [at, { opacity: 0, transform: "scale(0) rotate(-45deg)" }],
        [at + 320, { opacity: 1, transform: "scale(1) rotate(0deg)" }, "drop"],
      ]);
    });
  }
  if (intensity.shine) {
    track(stage.querySelector(".g-shine"), [
      [burst + 760, { opacity: 0, transform: "translateX(-22px) skewX(-20deg)" }],
      [
        burst + 880,
        { opacity: 0.75, transform: "translateX(-10px) skewX(-20deg)" },
        "standard",
      ],
      [
        burst + 1360,
        { opacity: 0, transform: "translateX(26px) skewX(-20deg)" },
        "standard",
      ],
    ]);
  }

  const landAt = burst + 300;
  for (const layer of [q("slot"), q("gems"), q("back")]) {
    track(layer, [
      [0, moment],
      [landAt, moment],
      [landAt + 320, HOME, "standard"],
    ]);
  }

  track(q("avatar"), [
    [landAt, { opacity: 0, transform: "translateY(24px) scale(.9)" }],
    [landAt + 320, { opacity: 1, transform: "none" }, "drop"],
  ]);

  const bottom = stage.querySelector("[data-winner-bottom]");
  const controls = bottom
    ? [
        bottom.querySelector(":scope > p.border-dashed"),
        bottom.querySelector(":scope > div.flex-wrap"),
        bottom.querySelector(":scope > p.text-xs"),
      ]
    : [];
  controls.forEach((el, index) => {
    const at = landAt + 120 + index * 40;
    track(el, [
      [at, { opacity: 0, transform: "translateY(8px)" }],
      [at + 200, { opacity: 1, transform: "none" }, "standard"],
    ]);
  });

  const idle = burst + 1000;
  const idleEnd = idle + 4800;
  const beams = stage.querySelectorAll<HTMLElement>(".sd-winner-beam");
  beams.forEach((beam) => {
    track(beam, [
      [0, "translateX(-50%) scaleY(0)"],
      [burst, "translateX(-50%) scaleY(0)"],
      [burst + 700, "translateX(-50%) scaleY(1)", "standard"],
    ]);
  });
  timers.push(
    window.setTimeout(() => {
      beams.forEach((beam) => {
        beam.style.animation = "none";
      });
    }, idleEnd),
  );

  if (intensity.rays) {
    track(q("rays"), [
      [burst + 120, { opacity: 0, transform: "rotate(0deg) scale(.7)" }],
      [burst + 320, { opacity: 1, transform: "rotate(30deg) scale(1)" }, "linear"],
      [burst + 1820, { opacity: 1, transform: "rotate(255deg) scale(1)" }, "linear"],
      [burst + 2520, { opacity: 0, transform: "rotate(360deg) scale(1)" }, "linear"],
    ]);
  }

  const [mouthX, mouthY] = placed.map(placed.cx, placed.mouth);
  const fx = q("fx");
  if (fx) {
    const colored = Math.min(CONFETTI_CAP, intensity.conf);
    const amber = Math.min(CONFETTI_CAP - colored, intensity.burst);
    spawnConfetti(fx, animations, mouthX - 12, mouthY, colored, {
      start: burst + 80,
      spread: 100,
      power: 760,
      gravity: 2600,
      minY: placed.minY,
      life: 1050,
      seed: 11,
    });
    if (amber > 0) {
      spawnConfetti(fx, animations, mouthX - 12, mouthY - 40 * placed.scale, amber, {
        start: burst + 200,
        spread: 150,
        power: 640,
        gravity: 2400,
        minY: placed.minY,
        life: 1000,
        seed: 5,
        colors: ["#FBBF24", "#FDE68A", "#F59E0B"],
      });
    }
  }

  const breathe = part(".b-breathe");
  if (breathe) {
    const animation = breathe.animate(
      [{ transform: "scale(1, 1)" }, { transform: "scale(1.012, .985)" }],
      {
        duration: 2400,
        delay: idle,
        iterations: 2,
        direction: "alternate",
        easing: EASE.idle,
        fill: "both",
      },
    );
    animations.push(animation);
  }
  const bob = q("gem-bob");
  if (bob) {
    const animation = bob.animate(
      [{ transform: "translateY(0px)" }, { transform: "translateY(-6px)" }],
      {
        duration: 2400,
        delay: idle,
        iterations: 2,
        direction: "alternate",
        easing: EASE.idle,
        fill: "both",
      },
    );
    animations.push(animation);
  }
  const blinkAt = idle + 1800;
  const blinks: RevealFrame[] = [[blinkAt, "scaleY(1)"]];
  for (const at of [blinkAt, blinkAt + 2600]) {
    if (at !== blinkAt) blinks.push([at, "scaleY(1)"]);
    blinks.push(
      [at + 80, "scaleY(.12)", "standard"],
      [at + 160, "scaleY(1)", "standard"],
    );
  }
  track(part(".b-eyeO"), blinks);
}

interface Placement {
  cx: number;
  mouth: number;
  moment: string;
  map: (x: number, y: number) => [number, number];
  minY: number;
  scale: number;
}

function place(stage: HTMLElement): Placement {
  const q = (name: string) =>
    stage.querySelector<HTMLElement>(`[data-reveal='${name}']`);
  const stageBox = stage.getBoundingClientRect();
  const slot = q("slot");
  const slotBox = slot?.getBoundingClientRect();
  const slotX = slotBox ? slotBox.left - stageBox.left : 0;
  const slotY = slotBox ? slotBox.top - stageBox.top : 0;
  const slotW = slotBox?.width || 152.7;
  const slotH = slotBox?.height || 144;
  const unit = slotH / 66;
  const scale = slotH / 144;
  const cx = slotX + slotW / 2 - 3 * unit;
  const lidTop = slotY + 8 * unit;
  const gemSize = 84 * scale;
  const gemTop = lidTop - 26 * scale - gemSize;
  const gem = q("gem");
  if (gem) {
    gem.style.left = `${cx - gemSize / 2}px`;
    gem.style.top = `${gemTop}px`;
    gem.style.width = `${gemSize}px`;
    gem.style.height = `${gemSize}px`;
  }
  const gemCenter = gemTop + gemSize / 2;
  const halo = q("halo");
  const haloSize = 260 * scale;
  if (halo) {
    halo.style.left = `${cx - haloSize / 2}px`;
    halo.style.top = `${gemCenter - haloSize / 2}px`;
    halo.style.width = `${haloSize}px`;
    halo.style.height = `${haloSize}px`;
  }
  const rays = q("rays");
  const raysSize = 560 * scale;
  if (rays) {
    rays.style.left = `${cx - raysSize / 2}px`;
    rays.style.top = `${gemCenter - raysSize / 2}px`;
    rays.style.width = `${raysSize}px`;
    rays.style.height = `${raysSize}px`;
  }
  const sparks = [...stage.querySelectorAll<HTMLElement>("[data-reveal='spark']")];
  const sparkLayout = [
    { x: 48, y: -10, size: 24 },
    { x: -74, y: 58, size: 18 },
  ];
  sparks.forEach((spark, index) => {
    const spec = sparkLayout[index];
    if (!spec) return;
    spark.style.left = `${cx + spec.x * scale}px`;
    spark.style.top = `${gemTop + spec.y * scale}px`;
    spark.style.width = `${spec.size * scale}px`;
    spark.style.height = `${spec.size * scale}px`;
  });

  const originX = slotX + slotW / 2;
  const originY = slotY + slotH;
  for (const layer of [q("gems"), q("back")]) {
    if (layer) layer.style.transformOrigin = `${originX}px ${originY}px`;
  }
  const dx = stageBox.width / 2 - originX;
  const dy = -70 * scale;
  const moment = `translate(${dx.toFixed(1)}px, ${dy}px) scale(1.6)`;
  const map = (x: number, y: number): [number, number] => [
    originX + dx + 1.6 * (x - originX),
    originY + dy + 1.6 * (y - originY),
  ];
  return {
    cx,
    mouth: slotY + 30 * unit,
    moment,
    map,
    minY: stageBox.height * (300 / 1080),
    scale,
  };
}

interface ConfettiOptions {
  start: number;
  spread: number;
  power: number;
  gravity: number;
  minY: number;
  life: number;
  seed: number;
  colors?: string[];
}

function spawnConfetti(
  layer: HTMLElement,
  animations: Animation[],
  x: number,
  y: number,
  count: number,
  options: ConfettiOptions,
) {
  const random = rng(options.seed);
  const colors = options.colors ?? [
    "#FBBF24",
    "#FB923C",
    "#38BDF8",
    "#F472B6",
    "#FBBF24",
  ];
  const spread = (options.spread * Math.PI) / 180;
  const direction = (-90 * Math.PI) / 180;
  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("span");
    piece.dataset.winnerConfetti = "";
    piece.className = "sd-winner-confetti";
    const width = 18 + random() * 10;
    const height = 11 + random() * 6;
    piece.style.width = `${width}px`;
    piece.style.height = `${height}px`;
    piece.style.background = colors[index % colors.length];
    layer.appendChild(piece);
    const angle = direction + (random() - 0.5) * spread;
    const velocity = options.power * (0.55 + random() * 0.55);
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    const spin = (random() - 0.5) * 900;
    const life = options.life * (0.8 + random() * 0.4);
    const drag = 0.55;
    const steps = 9;
    const path: RevealFrame[] = [];
    let launch = "translate(0px, 0px)";
    for (let step = 0; step <= steps; step += 1) {
      const local = (step / steps) * life;
      const seconds = local / 1000;
      const falloff = 1 - Math.exp(-drag * seconds * 2.2);
      let px = x + (vx * falloff) / (drag * 2.2);
      let py =
        y +
        (vy * falloff) / (drag * 2.2) +
        0.5 * options.gravity * seconds * seconds * 0.55;
      if (py < options.minY) py = options.minY;
      const progress = step / steps;
      const opacity = progress < 0.72 ? 1 : 1 - (progress - 0.72) / 0.28;
      const transform =
        `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) ` +
        `rotate(${(spin * seconds).toFixed(0)}deg) ` +
        `rotateX(${(seconds * 540).toFixed(0)}deg)`;
      if (step === 0) launch = transform;
      path.push([options.start + local, { opacity, transform }]);
    }
    const frames: RevealFrame[] = [
      [0, { opacity: 0, transform: launch }],
      [Math.max(0, options.start - 1), { opacity: 0, transform: launch }],
      ...path,
    ];
    const end = Math.max(1, frames[frames.length - 1][0]);
    const keyframes: Keyframe[] = frames.map(([time, props]) => {
      const value = typeof props === "string" ? { transform: props } : props;
      return { ...value, offset: Math.min(1, time / end) };
    });
    animations.push(
      piece.animate(keyframes, { duration: end, fill: "both", easing: "linear" }),
    );
  }
}

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
