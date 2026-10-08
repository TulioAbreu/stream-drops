import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { cdp } from "vitest/browser"
import "@/i18n"
import { RARITY_LEVELS, RarityBadge, type RarityLevel } from "./rarity-badge"

const LABELS: Record<RarityLevel, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
}

const ORNAMENTS: Record<RarityLevel, string> = {
  common: "ring",
  uncommon: "notched",
  rare: "double",
  epic: "points",
  legendary: "crown",
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
    .toLowerCase()
}

describe("tokens de raridade", () => {
  it("existem nos temas claro e escuro", () => {
    const root = document.documentElement
    root.classList.remove("dark", "light")

    expect(cssVar("--rarity-common")).toBe("#78716c")
    expect(cssVar("--rarity-uncommon")).toBe("#16a34a")
    expect(cssVar("--rarity-rare")).toBe("#0284c7")
    expect(cssVar("--rarity-epic")).toBe("#db2777")
    expect(cssVar("--rarity-legendary")).toBe("#d97706")
    expect(cssVar("--rarity-common-foreground")).toBe("#57534e")
    expect(cssVar("--rarity-uncommon-foreground")).toBe("#166534")
    expect(cssVar("--rarity-rare-foreground")).toBe("#075985")
    expect(cssVar("--rarity-epic-foreground")).toBe("#9d174d")
    expect(cssVar("--rarity-legendary-foreground")).toBe("#92400e")
    expect(cssVar("--rarity-uncommon-soft")).toBe("#dcfce7")
    expect(cssVar("--rarity-uncommon-glow")).toContain("22, 163, 74")
    expect(cssVar("--sd-rarity-uncommon")).toBe("#16a34a")

    root.classList.add("dark")
    expect(cssVar("--rarity-common")).toBe("#a8a29e")
    expect(cssVar("--rarity-uncommon")).toBe("#4ade80")
    expect(cssVar("--rarity-rare")).toBe("#38bdf8")
    expect(cssVar("--rarity-epic")).toBe("#f472b6")
    expect(cssVar("--rarity-legendary")).toBe("#fbbf24")
    expect(cssVar("--rarity-common-foreground")).toBe("#d6d3d1")
    expect(cssVar("--rarity-uncommon-foreground")).toBe("#86efac")
    expect(cssVar("--rarity-rare-foreground")).toBe("#7dd3fc")
    expect(cssVar("--rarity-epic-foreground")).toBe("#f9a8d4")
    expect(cssVar("--rarity-legendary-foreground")).toBe("#fcd34d")
    expect(cssVar("--rarity-uncommon-soft")).toContain("74, 222, 128")
    expect(cssVar("--rarity-legendary-glow")).toContain("251, 191, 36")
    expect(cssVar("--sd-rarity-uncommon")).toBe("#4ade80")
    root.classList.remove("dark")
  })
})

describe("RarityBadge", () => {
  it("mostra os 5 níveis com forma e aria-label de nome e raridade", () => {
    render(
      <div>
        {RARITY_LEVELS.map((rarity) => (
          <RarityBadge key={rarity} name="Lenda do Baú" rarity={rarity} />
        ))}
      </div>
    )

    const badges = document.querySelectorAll("[data-slot='rarity-badge']")
    expect(badges).toHaveLength(5)

    const ornaments = new Set<string>()
    for (const rarity of RARITY_LEVELS) {
      const badge = screen.getByRole("img", {
        name: `Lenda do Baú, ${LABELS[rarity]}`,
      })
      expect(badge.getAttribute("data-rarity")).toBe(rarity)
      expect(badge.getAttribute("data-ornament")).toBe(ORNAMENTS[rarity])
      ornaments.add(badge.getAttribute("data-ornament") ?? "")
      expect(badge.querySelectorAll("polygon").length).toBeGreaterThan(0)
    }

    expect(ornaments).toEqual(
      new Set(["ring", "notched", "double", "points", "crown"])
    )
    expect(
      document.querySelector("[data-rarity='common'] polygon")?.getAttribute(
        "points"
      )?.split(" ").length
    ).toBe(6)
    expect(
      document
        .querySelector("[data-rarity='uncommon'] polygon")
        ?.getAttribute("points")
        ?.split(" ").length
    ).toBeGreaterThan(6)
    expect(
      document.querySelectorAll("[data-rarity='rare'] polygon")
    ).toHaveLength(2)
    expect(
      document.querySelectorAll("[data-rarity='epic'] > path")
    ).toHaveLength(6)
    expect(document.querySelector("[data-rarity-crown]")).toBeTruthy()
    expect(document.querySelectorAll("[data-rarity-rays]")).toHaveLength(1)
  })

  it("gira os raios do Lendário uma vez e respeita reduced-motion", async () => {
    const { unmount } = render(
      <RarityBadge name="Chama eterna" rarity="legendary" />
    )
    const rays = document.querySelector("[data-rarity-rays]")
    expect(rays).toBeTruthy()
    expect(getComputedStyle(rays!).animationName).toBe("sd-rarity-rays")
    expect(getComputedStyle(rays!).animationIterationCount).toBe("1")
    unmount()

    const client = cdp()
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    })
    try {
      render(<RarityBadge name="Chama eterna" rarity="legendary" />)
      const reduced = document.querySelector("[data-rarity-rays]")
      expect(getComputedStyle(reduced!).animationName).toBe("none")
    } finally {
      await client.send("Emulation.setEmulatedMedia", { features: [] })
    }
  })

})
