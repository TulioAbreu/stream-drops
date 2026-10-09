import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import "@/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

describe("navegação", () => {
  it("mostra Pontos do Canal e o selo Beta só no Subathon", async () => {
    await page.viewport(1280, 800);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/dashboard/settings"]}>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const points = screen.getByRole("link", { name: /pontos do canal/i });
    expect(points.getAttribute("href")).toBe(
      "/dashboard/channel-points-giveaway",
    );
    expect(points.textContent).not.toMatch(/beta/i);

    const subathon = screen.getByRole("link", { name: /subathon/i });
    expect(subathon.textContent).toMatch(/beta/i);
    expect(screen.getAllByText("Beta")).toHaveLength(1);
  });
});
