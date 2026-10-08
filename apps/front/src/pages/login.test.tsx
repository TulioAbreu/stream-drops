import { SessionExpiredModal } from "@/components/session-expired-modal";
import { ThemeProvider } from "@/components/theme-provider";
import "@/i18n";
import { LoginPage } from "@/pages/login";
import { useLoginStore } from "@/storage/login";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

function renderWithProviders(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function expectNoOtherPlatforms(text: string) {
  expect(text).not.toMatch(/kick/i);
  expect(text).not.toMatch(/youtube/i);
  expect(text).not.toMatch(/em breve/i);
}

describe("login", () => {
  afterEach(() => {
    cleanup();
    useLoginStore.setState({
      twitchAccessToken: null,
      sessionExpired: false,
      driveCode: null,
    });
  });

  it("só oferece Twitch", () => {
    renderWithProviders(<LoginPage />);
    expect(
      screen.getByRole("button", { name: /entrar com twitch/i }),
    ).toBeTruthy();
    expect(screen.getByText(/seu sorteio,/i)).toBeTruthy();
    expectNoOtherPlatforms(document.body.textContent ?? "");
  });

  it("sessão expirada também só oferece Twitch", () => {
    useLoginStore.setState({ sessionExpired: true, twitchAccessToken: null });
    renderWithProviders(<SessionExpiredModal />);
    expect(screen.getByText(/sessão expirada/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /entrar com twitch/i }),
    ).toBeTruthy();
    expectNoOtherPlatforms(document.body.textContent ?? "");
  });
});
