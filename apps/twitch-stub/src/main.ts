import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { getStubConfig } from "./stub.types";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = getStubConfig();

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Dev stub: allow any localhost / 127.0.0.1 origin (Vite may use 3000, 3001, …)
      if (
        !origin ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  await app.listen(config.port);
  console.log(
    `Twitch API stub listening on http://localhost:${config.port} (partner=${config.broadcasterLogin})`
  );
}

bootstrap();
