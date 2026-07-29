import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export function resolveDatabasePath(): string {
  const fileName = "subathon.sqlite";
  const candidates = [
    join(homedir(), "Library", "Application Support", "StreamDrops", fileName),
    join(
      process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
      "StreamDrops",
      fileName,
    ),
    join(homedir(), ".local", "share", "StreamDrops", fileName),
    join(process.cwd(), fileName),
  ];

  for (const candidate of candidates) {
    const dir = join(candidate, "..");
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      return candidate;
    } catch {
      continue;
    }
  }

  return join(process.cwd(), fileName);
}

export function resolvePublicPath(): string {
  const nextToExe = join(process.cwd(), "public");
  if (existsSync(nextToExe)) {
    return nextToExe;
  }

  return join(__dirname, "..", "public");
}
