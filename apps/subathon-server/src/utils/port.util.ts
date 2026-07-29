import {
  DEFAULT_HOST,
  PORT_RANGE_END,
  PORT_RANGE_START,
} from "@stream-drops/subathon-protocol";
import { createServer } from "net";

export async function findAvailablePort(
  host = DEFAULT_HOST,
  start = PORT_RANGE_START,
  end = PORT_RANGE_END,
): Promise<number> {
  for (let port = start; port <= end; port += 1) {
    const available = await isPortAvailable(host, port);
    if (available) {
      return port;
    }
  }

  throw new Error(
    `No available port in range ${start}-${end} on ${host}`,
  );
}

function isPortAvailable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}
