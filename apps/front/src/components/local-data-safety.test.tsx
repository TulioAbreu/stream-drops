import { DeleteLocalDataDialog } from "@/components/delete-local-data-dialog";
import { LogoutDialog } from "@/components/logout-dialog";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
} from "@/database";
import "@/i18n";
import { LocalDataPanel } from "@/pages/settings/local-data-panel";
import { useLoginStore } from "@/storage/login";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

const SENTINEL_KEY = "sd-sentinel-keep";
const SENTINEL_VALUE = "fica";
const TOKEN = "token-secreto-nao-apagar";

const EXCLUSION = {
  twitchUserId: "100",
  username: "nightbot",
  displayName: "Nightbot",
  profileImageUrl: "",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    const timer = setTimeout(() => {
      reject(new Error("deleteDatabase bloqueado"));
    }, 2000);
    request.onsuccess = () => {
      clearTimeout(timer);
      resolve();
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
  });
}

function seedDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore("exclusion-list", {
        keyPath: "twitchUserId",
      });
      store.add(EXCLUSION);
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

async function readExclusion(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("exclusion-list")) {
        const version = db.version;
        db.close();
        resolve({ missing: true, version });
        return;
      }
      const tx = db.transaction("exclusion-list", "readonly");
      const read = tx.objectStore("exclusion-list").get(EXCLUSION.twitchUserId);
      read.onsuccess = () => {
        const version = db.version;
        db.close();
        resolve({ version, record: read.result });
      };
      read.onerror = () => {
        db.close();
        reject(read.error);
      };
    };
  });
}

async function seedBrowser() {
  await deleteDatabase();
  await seedDatabase();
  localStorage.setItem(SENTINEL_KEY, SENTINEL_VALUE);
  useLoginStore.setState({
    twitchAccessToken: TOKEN,
    driveCode: "drive-secreto",
    sessionExpired: false,
  });
}

async function expectDataIntact() {
  const stored = (await readExclusion()) as {
    version: number;
    record: typeof EXCLUSION;
  };
  expect(stored.version).toBe(12);
  expect(stored.record).toEqual(EXCLUSION);
  expect(localStorage.getItem(SENTINEL_KEY)).toBe(SENTINEL_VALUE);
  expect(useLoginStore.getState().twitchAccessToken).toBe(TOKEN);
}

describe("apagar dados e logout", () => {
  afterEach(async () => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "sidebar_state=; path=/; max-age=0";
    document.cookie = "sd_keep=; path=/; max-age=0";
    useLoginStore.setState({
      twitchAccessToken: null,
      driveCode: null,
      sessionExpired: false,
    });
    await deleteDatabase();
  });

  it("não apaga nada ao cancelar o diálogo de Configurações", async () => {
    await seedBrowser();
    render(<LocalDataPanel />);
    await screen.findByText(/lista de exclusão/i);
    fireEvent.click(
      screen.getByRole("button", { name: /apagar dados locais/i }),
    );

    expect(
      screen.getByRole("heading", {
        name: /apagar todos os dados deste navegador/i,
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/confirmar logout/i)).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/exporte um backup json antes/i)).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /exportar backup json/i }).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await expectDataIntact();
  });

  it("não apaga nada sem digitar a palavra", async () => {
    await seedBrowser();
    render(<LocalDataPanel />);
    await screen.findByText(/lista de exclusão/i);
    fireEvent.click(
      screen.getByRole("button", { name: /apagar dados locais/i }),
    );

    const confirm = screen.getByRole("button", {
      name: /apagar todos os dados/i,
    });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.click(confirm);

    fireEvent.change(screen.getByLabelText(/digite apagar para confirmar/i), {
      target: { value: "NAO" },
    });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.click(confirm);

    await expectDataIntact();
    expect(
      screen.getByRole("heading", {
        name: /apagar todos os dados deste navegador/i,
      }),
    ).toBeTruthy();
  });

  it("o logout comum não apaga dados e a caixa começa desmarcada", async () => {
    await seedBrowser();
    let left = false;
    render(
      <LogoutDialog
        leave={() => {
          left = true;
        }}
        trigger={<button type="button">abrir logout</button>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /abrir logout/i }));
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/confirmar logout/i)).toBeTruthy();

    fireEvent.click(checkbox);
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: /abrir logout/i }));
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe(
      "false",
    );

    sessionStorage.setItem("sd-logout", "fica");
    document.cookie = "sidebar_state=true; path=/";
    fireEvent.click(screen.getByRole("button", { name: /sair da conta/i }));

    expect(left).toBe(true);
    const stored = (await readExclusion()) as {
      version: number;
      record: typeof EXCLUSION;
    };
    expect(stored.version).toBe(12);
    expect(stored.record).toEqual(EXCLUSION);
    expect(localStorage.getItem(SENTINEL_KEY)).toBe(SENTINEL_VALUE);
    expect(sessionStorage.getItem("sd-logout")).toBe("fica");
    expect(document.cookie).toContain("sidebar_state=true");
    expect(useLoginStore.getState().twitchAccessToken).toBeNull();
    expect(useLoginStore.getState().driveCode).toBe("drive-secreto");
  });

  it("apaga só depois de digitar APAGAR", async () => {
    await seedBrowser();
    sessionStorage.setItem("sd-wipe", "some");
    document.cookie = "sidebar_state=false; path=/";
    document.cookie = "sd_keep=1; path=/";
    let left = false;
    render(
      <DeleteLocalDataDialog
        leave={() => {
          left = true;
        }}
        trigger={<button type="button">abrir apagar</button>}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /abrir apagar/i }));
    fireEvent.change(screen.getByLabelText(/digite apagar para confirmar/i), {
      target: { value: "apagar" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /apagar todos os dados/i }),
    );

    await waitFor(() => {
      expect(localStorage.getItem(SENTINEL_KEY)).toBeNull();
    });
    expect(left).toBe(true);
    const databases = await indexedDB.databases();
    expect(
      databases.some((database) => database.name === DATABASE_NAME),
    ).toBe(false);
    expect(localStorage.getItem("login-storage")).toBeNull();
    expect(sessionStorage.getItem("sd-wipe")).toBeNull();
    expect(document.cookie).not.toContain("sidebar_state");
    expect(document.cookie).toContain("sd_keep=1");
  });
});
