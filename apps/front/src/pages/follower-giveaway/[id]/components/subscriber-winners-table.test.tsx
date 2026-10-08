import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { SubscriberWinnersTable } from "./subscriber-winners-table";
import type { BroadcasterSubscriber } from "@/service/twitch/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockWinners: BroadcasterSubscriber[] = [
  { user_id: "3", user_name: "User3", user_login: "user3", tier: "1000" },
  { user_id: "2", user_name: "User2", user_login: "user2", tier: "2000" },
  { user_id: "1", user_name: "User1", user_login: "user1", tier: "3000" },
];

describe("SubscriberWinnersTable", () => {
  it("T8-B: não muta o array original", () => {
    const original = [...mockWinners];

    render(<SubscriberWinnersTable winners={mockWinners} onRemove={vi.fn()} />);

    expect(mockWinners).toEqual(original);
  });

  it("T8-C: renderiza o componente sem erros", () => {
    const { container } = render(
      <SubscriberWinnersTable winners={mockWinners} onRemove={vi.fn()} />
    );

    expect(container.firstChild).toBeTruthy();
  });
});
