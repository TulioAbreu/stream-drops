import { DeleteGiveawayDialog } from "@/components/delete-giveaway-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import "@/i18n";
import { DialogTitle } from "@radix-ui/react-dialog";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

/** Relativo ao arquivo de teste. O Vite não deixa gravar fora do app. */
const SHOTS = "../../.vitest-screenshots";

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
    path: `${SHOTS}/s4-dialog-${name}.png`,
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

  it("o diálogo antigo só confirmava a exclusão", async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button">Abrir exclusão antiga</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este sorteio? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="button" variant="destructive">Deletar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir exclusão antiga" }));
    expect(await screen.findByRole("heading", { name: "Confirmar exclusão" })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();

    setTheme("dark");
    await shot("before-dark");
    setTheme("light");
    await shot("before-light");
  });
});
