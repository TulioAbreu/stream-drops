import { DeleteGiveawayDialog } from "@/components/delete-giveaway-dialog";
import { Button } from "@/components/ui/button";
import "@/i18n";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

const ARTIFACTS = "/opt/cursor/artifacts";

function storageKeys() {
  return {
    local: Object.keys(localStorage).sort(),
    session: Object.keys(sessionStorage).sort(),
    cookie: document.cookie,
  };
}

function setTheme(theme: "dark" | "light") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  document.body.style.background = theme === "dark" ? "#0a0a0a" : "#ffffff";
}

async function shot(name: string) {
  const dialog = page.getByRole("dialog");
  await dialog.screenshot({
    path: `${ARTIFACTS}/s4-dialog-${name}.png`,
  });
}

function renderDialog(onConfirm = vi.fn()) {
  render(
    <DeleteGiveawayDialog
      onConfirm={onConfirm}
      trigger={<Button type="button">Abrir exclusão</Button>}
    />,
  );
  return onConfirm;
}

describe("diálogo de excluir sorteio", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
    document.body.style.background = "";
  });

  it("começa desmarcado, confirma o hard delete só marcado e zera ao reabrir", async () => {
    setTheme("dark");
    const before = storageKeys();
    const onConfirm = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Abrir exclusão" }));
    expect(
      await screen.findByRole("heading", { name: "Excluir sorteio" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "As vitórias deste sorteio continuam no histórico de vitórias.",
      ),
    ).toBeTruthy();
    const checkbox = screen.getByRole("checkbox", {
      name: "Apagar também do histórico de vitórias",
    });
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: "Deletar" })).toBeTruthy();
    expect(document.body.textContent ?? "").not.toMatch(/kick|youtube/i);

    await shot("dark-unchecked");

    fireEvent.click(screen.getByRole("button", { name: "Deletar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(false);

    fireEvent.click(checkbox);
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    await shot("dark-checked");
    fireEvent.click(screen.getByRole("button", { name: "Deletar" }));
    expect(onConfirm).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Abrir exclusão" }));
    const reopened = await screen.findByRole("checkbox", {
      name: "Apagar também do histórico de vitórias",
    });
    expect(reopened.getAttribute("aria-checked")).toBe("false");

    setTheme("light");
    await shot("light-unchecked");
    fireEvent.click(reopened);
    expect(reopened.getAttribute("aria-checked")).toBe("true");
    await shot("light-checked");

    expect(storageKeys()).toEqual(before);
  });
});
