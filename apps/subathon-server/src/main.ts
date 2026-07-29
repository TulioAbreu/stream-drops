import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WsAdapter } from "@nestjs/platform-ws";
import { DEFAULT_HOST } from "@stream-drops/subathon-protocol";
import { AppModule } from "./app.module";
import { SubathonGatewayService } from "./gateway/subathon-gateway.service";
import { DatabaseService } from "./persistence/database.service";
import { findAvailablePort } from "./utils/port.util";

async function bootstrap() {
  const port = await findAvailablePort(DEFAULT_HOST);
  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new WsAdapter(app));

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (
        !origin ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  });

  const gateway = app.get(SubathonGatewayService);
  gateway.setPort(port);

  const database = app.get(DatabaseService);

  await app.listen(port, DEFAULT_HOST);

  console.log(
    `Subathon server listening on http://${DEFAULT_HOST}:${port}`,
  );
  console.log(`Overlay URL: http://${DEFAULT_HOST}:${port}/overlay`);
  console.log(`WebSocket: ws://${DEFAULT_HOST}:${port}/ws`);
  console.log(`SQLite: ${database.dbPath}`);
}

bootstrap();
