import { chromium } from "playwright";
import { mkdir, rename } from "node:fs/promises";

const baseUrl = process.env.S0_BASE_URL ?? "http://localhost:3000";
const outDir = process.env.S0_VIDEO_DIR ?? "/opt/cursor/artifacts";

const participants = [
  ["ana-um", "Ana Um"],
  ["ana-dois", "Ana Dois"],
  ["bruno", "Bruno"],
  ["carla", "Carla"],
  ["edu", "Edu"],
  ["fabio", "Fabio"],
  ["guto", "Guto"],
  ["helo", "Helo"],
  ["igor", "Igor"],
  ["mod", "Mod Bot"],
].map(([id, displayName], index) => ({
  id,
  name: id,
  displayName,
  avatar: "https://example.com/avatar.png",
  subscriber: false,
  joinedAt: 1_000 - index,
}));

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1400, height: 900 },
  recordVideo: { dir: outDir, size: { width: 1400, height: 900 } },
});
const page = await context.newPage();
await page.route("**/*twitch.tv/**", (route) => route.abort());

try {
  await page.goto(baseUrl);
  await page.getByRole("button", { name: /Twitch Stub/ }).click();
  await page.waitForURL("**/dashboard");

  await page.evaluate(async ({ participants }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("stream-drops-db", 12);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("chat-giveaways")) {
          database.createObjectStore("chat-giveaways", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("exclusion-list")) {
          const store = database.createObjectStore("exclusion-list", {
            keyPath: "twitchUserId",
          });
          store.createIndex("username", "username", { unique: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise((resolve, reject) => {
      const tx = db.transaction(
        ["chat-giveaways", "exclusion-list"],
        "readwrite",
      );
      tx.objectStore("chat-giveaways").put({
        id: "s0-demo",
        title: "Sorteio do chat",
        description: "Demo do filtro e da lista de exclusão",
        keyword: "!join",
        cost: 0,
        minimumSuscriptionTimeInMonths: 0,
        subscriberMultiplier: 1,
        subscribersOnly: false,
        winners: [],
        participants,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      tx.objectStore("exclusion-list").put({
        twitchUserId: "mod",
        username: "modbot",
        displayName: "Mod Bot",
        profileImageUrl: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { participants });

  await page.goto(`${baseUrl}/dashboard/settings`);
  await page.getByText("Mod Bot").waitFor();
  await page.waitForTimeout(1600);

  await page.goto(`${baseUrl}/dashboard/chat-giveaway/s0-demo`);
  await page.getByText("9 participantes elegíveis").waitFor();
  await page.getByText("Bruno").waitFor();
  if (await page.getByText("Mod Bot").count()) {
    throw new Error("Mod Bot apareceu na lista mesmo excluído");
  }
  await page.waitForTimeout(1400);

  const filter = page.getByRole("textbox", { name: "Filtrar por nome..." });
  await filter.click();
  await filter.pressSequentially("ana", { delay: 180 });
  await page.getByText("2 encontrados (de 9 elegíveis)").waitFor();
  await page
    .getByText("O sorteio considera todos os elegíveis, não só os filtrados")
    .waitFor();
  await page.waitForTimeout(1800);

  await page.getByRole("button", { name: "Sortear Vencedor" }).click();
  const winnerName = page.locator("p").filter({ hasText: /Ana Um|Ana Dois|Bruno|Carla|Edu|Fabio|Guto|Helo|Igor/ }).first();
  await page.getByRole("button", { name: "Confirmar" }).waitFor();
  const cardText = await page.locator("body").innerText();
  if (cardText.includes("Mod Bot")) {
    throw new Error("O sorteio mostrou o excluído");
  }
  await winnerName.waitFor();
  await page.waitForTimeout(2500);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const saved = await video.path();
    const target = `${outDir}/s0-sorteio-filtro-exclusao.webm`;
    await rename(saved, target);
    console.log(target);
  }
}
