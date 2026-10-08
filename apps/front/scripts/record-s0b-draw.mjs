import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";

const baseUrl = process.env.S0B_BASE_URL ?? "http://127.0.0.1:3000";
const outDir = process.env.S0B_VIDEO_DIR ?? "/opt/cursor/artifacts";
const workDir = "/tmp/s0b-video";

const pointsParticipants = [
  {
    userId: "stub-user-mira",
    name: "mira",
    displayName: "mira",
    avatar: "",
    subscriber: false,
    tier: null,
    tickets: [
      {
        redemptionId: "mira-ticket-0",
        redeemedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
  {
    userId: "stub-user-ana",
    name: "ana",
    displayName: "ana",
    avatar: "",
    subscriber: false,
    tier: null,
    tickets: [
      {
        redemptionId: "ana-ticket-0",
        redeemedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
];

function subscriber(userId, userName) {
  return {
    broadcaster_id: "stub-broadcaster-1",
    broadcaster_login: "stub_partner",
    broadcaster_name: "Stub Partner",
    gifter_id: "",
    gifter_login: "",
    is_gift: false,
    plan_name: "Tier 1",
    tier: "1000",
    user_id: userId,
    user_name: userName,
    user_login: userName,
  };
}

const subKai = subscriber("stub-user-kai", "kai");
const subAna = subscriber("stub-user-ana", "ana");
const subSolo = subscriber("stub-user-solo", "solo");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} saiu com código ${code}`));
    });
  });
}

await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: workDir, size: { width: 1280, height: 800 } },
});

const page = await context.newPage();
const t0 = Date.now();
const marks = {};
function mark(name) {
  marks[name] = Date.now() - t0;
  console.log("MARK", name, marks[name]);
}

async function seed() {
  await page.evaluate(
    async ({ pointsParticipants, subKai, subAna, subSolo }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("stream-drops-db");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      await new Promise((resolve, reject) => {
        const tx = db.transaction(
          ["channel-points-giveaways", "giveaways"],
          "readwrite",
        );
        tx.objectStore("channel-points-giveaways").put({
          id: "s0b-pontos",
          title: "Sorteio de Pontos",
          description: "Demo da lista de exclusão",
          cost: 100,
          rewardId: "reward-demo",
          rewardEnabled: true,
          maxPerStream: null,
          subscribersOnly: false,
          subscriptionRequirement: 0,
          subscriberMultiplier: { 1000: 1, 2000: 1, 3000: 1 },
          refundIneligible: false,
          allowMultipleWins: false,
          status: "ready",
          participants: pointsParticipants,
          winners: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        });
        tx.objectStore("giveaways").put({
          id: "s0b-subs",
          title: "Sorteio de Subscribers",
          description: "Demo da lista de exclusão",
          subscriptionRequirement: 1000,
          subscriberMultiplier: { 1000: 1, 2000: 1, 3000: 1 },
          participants: [subKai, subAna],
          winners: [],
          spreadsheetUrl: null,
        });
        tx.objectStore("giveaways").put({
          id: "s0b-vazio",
          title: "Sorteio sem elegíveis",
          description: "Todos já foram sorteados",
          subscriptionRequirement: 1000,
          subscriberMultiplier: { 1000: 1, 2000: 1, 3000: 1 },
          participants: [subSolo],
          winners: [subSolo],
          spreadsheetUrl: null,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { pointsParticipants, subKai, subAna, subSolo },
  );
}

async function excludeInOtherTab(login) {
  const other = await context.newPage();
  await other.route("**/*twitch.tv/**", (route) => route.abort());
  await other.route("**/*dicebear.com/**", (route) => route.abort());
  await other.goto(`${baseUrl}/dashboard/settings`);
  await other.getByRole("button", { name: "Excluir de Sorteios" }).click();
  await other
    .getByPlaceholder("Digite o nome de usuário para excluir")
    .fill(login);
  await other.getByRole("button", { name: "Buscar Usuário" }).click();
  const dialog = other.getByRole("dialog");
  await dialog.getByText(login, { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Excluir de Sorteios" }).click();
  await other
    .getByText(`Usuário ${login} adicionado à lista de exclusão.`)
    .waitFor();
  await other.waitForTimeout(1600);
  const video = other.video();
  await other.close();
  return video.path();
}

/**
 * No Chromium headless toda aba permanece visibilityState "visible",
 * então bringToFront não dispara visibilitychange. O app escuta esse
 * evento quando a aba volta a ficar visível; aqui ele é o mesmo evento.
 */
async function returnToGiveawayTab() {
  await page.bringToFront();
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

let mainVideoPath = "";
const clips = [];

try {
  await page.route("**/*twitch.tv/**", (route) => route.abort());
  await page.route("**/*dicebear.com/**", (route) => route.abort());

  await page.goto(baseUrl);
  await page.getByRole("button", { name: /Twitch Stub/ }).click();
  await page.waitForURL("**/dashboard");

  await page.goto(`${baseUrl}/dashboard/settings`);
  await page.getByText("Lista de Exclusão de Sorteios").waitFor();
  await seed();

  await page.goto(`${baseUrl}/dashboard/channel-points-giveaway/s0b-pontos`);
  await page.getByText("mira", { exact: true }).waitFor();
  await page.getByText("ana", { exact: true }).waitFor();
  await page.getByText("2 tickets", { exact: true }).waitFor();
  mark("pointsShown");
  await page.waitForTimeout(2200);
  mark("pointsLeave");

  const settingsMira = await excludeInOtherTab("mira");
  mark("pointsReturn");
  await returnToGiveawayTab();
  await page.getByText("mira", { exact: true }).waitFor({ state: "hidden" });
  await page.getByText("1 tickets", { exact: true }).waitFor();
  await page.waitForTimeout(1400);

  await page.getByRole("button", { name: "Sortear Vencedor" }).click();
  await page.getByRole("button", { name: "Confirmar" }).waitFor();
  const pointsText = await page.locator("body").innerText();
  if (pointsText.includes("mira")) {
    throw new Error("mira ainda aparece depois do sorteio de Pontos");
  }
  if (!pointsText.includes("ana")) {
    throw new Error("ana não foi o resultado visível em Pontos");
  }
  await page.waitForTimeout(1800);
  mark("pointsDone");

  await page.goto(`${baseUrl}/dashboard/follower-giveaway/s0b-subs`);
  await page.getByText("kai", { exact: true }).waitFor();
  await page.getByText("ana", { exact: true }).waitFor();
  mark("subsShown");
  await page.waitForTimeout(2200);
  mark("subsLeave");

  const settingsKai = await excludeInOtherTab("kai");
  mark("subsReturn");
  await returnToGiveawayTab();
  await page.getByText("kai", { exact: true }).waitFor({ state: "hidden" });
  await page.getByText("ana", { exact: true }).waitFor();
  await page.waitForTimeout(1400);

  await page.getByRole("button", { name: "Sortear", exact: true }).click();
  await page.getByText("ana", { exact: true }).waitFor();
  await page.waitForTimeout(400);
  const subsText = await page.locator("body").innerText();
  if (/\bkai\b/.test(subsText)) {
    throw new Error("kai foi sorteado ou continuou na lista de Subscribers");
  }
  await page.waitForTimeout(1600);
  mark("subsDone");

  await page.goto(`${baseUrl}/dashboard/follower-giveaway/s0b-vazio`);
  await page.getByRole("heading", { name: "Sorteio sem elegíveis" }).waitFor();
  await page.getByRole("cell", { name: "solo" }).first().waitFor();
  mark("emptyShown");
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Sortear", exact: true }).click();
  await page.getByText("Nenhum participante encontrado.").waitFor();
  await page.getByRole("heading", { name: "Sorteio sem elegíveis" }).waitFor();
  await page.waitForTimeout(1800);
  mark("emptyDone");

  clips.push(
    { file: null, start: marks.pointsShown, end: marks.pointsLeave },
    { file: settingsMira, start: 0, end: null },
    { file: null, start: marks.pointsReturn, end: marks.pointsDone },
    { file: null, start: marks.subsShown, end: marks.subsLeave },
    { file: settingsKai, start: 0, end: null },
    { file: null, start: marks.subsReturn, end: marks.subsDone },
    { file: null, start: marks.emptyShown, end: marks.emptyDone },
  );
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    mainVideoPath = await video.path();
    await rename(mainVideoPath, `${workDir}/main.webm`);
    mainVideoPath = `${workDir}/main.webm`;
  }
}

if (!mainVideoPath) {
  throw new Error("vídeo principal não foi gravado");
}

for (const clip of clips) {
  if (clip.file == null) clip.file = mainVideoPath;
}

const parts = [];
for (let index = 0; index < clips.length; index += 1) {
  const clip = clips[index];
  const part = `${workDir}/part-${index}.webm`;
  const args = ["-y"];
  if (clip.start) args.push("-ss", (clip.start / 1000).toFixed(3));
  if (clip.end != null) args.push("-to", (clip.end / 1000).toFixed(3));
  args.push(
    "-i",
    clip.file,
    "-an",
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "1M",
    "-pix_fmt",
    "yuv420p",
    part,
  );
  await run("ffmpeg", args);
  parts.push(part);
}

const listPath = `${workDir}/concat.txt`;
await writeFile(
  listPath,
  parts.map((part) => `file '${part}'`).join("\n"),
);

const target = `${outDir}/s0b-exclusao-pontos-subscribers.webm`;
await run("ffmpeg", [
  "-y",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  listPath,
  "-c",
  "copy",
  target,
]);
console.log(target);
console.log(JSON.stringify(marks));
