import { describe, expect, it } from "vitest";
import { chatWinnerContextFromParticipant } from "./winner-context";

describe("context do vencedor de Chat", () => {
  it("copia só meses e tier que existem", () => {
    expect(
      chatWinnerContextFromParticipant({
        subscriptionMonths: 24,
        tier: 3000,
      }),
    ).toEqual({ subscriptionMonths: 24, tier: 3000 });

    expect(
      chatWinnerContextFromParticipant({
        subscriptionMonths: 0,
        tier: null,
      }),
    ).toEqual({ subscriptionMonths: 0 });

    expect(
      chatWinnerContextFromParticipant({
        subscriptionMonths: 12,
      }),
    ).toEqual({ subscriptionMonths: 12 });

    expect(
      chatWinnerContextFromParticipant({ tier: 2000 }),
    ).toEqual({ tier: 2000 });
  });

  it("não inventa meses nem tier", () => {
    expect(chatWinnerContextFromParticipant(undefined)).toEqual({});
    expect(chatWinnerContextFromParticipant(null)).toEqual({});
    expect(
      chatWinnerContextFromParticipant({
        subscriptionMonths: undefined,
        tier: null,
      }),
    ).toEqual({});
    expect(
      chatWinnerContextFromParticipant({
        subscriptionMonths: Number.NaN,
        tier: 1000,
      }),
    ).toEqual({ tier: 1000 });
    expect(
      chatWinnerContextFromParticipant({
        subscriptionMonths: Number.POSITIVE_INFINITY,
        tier: 0 as never,
      }),
    ).toEqual({});
  });
});
