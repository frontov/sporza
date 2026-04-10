import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";

import { AppModule } from "./app.module";

async function bootstrap() {
  const corsOrigins = (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const app = await NestFactory.create(AppModule, {
    cors:
      corsOrigins.length > 0
        ? {
            origin: corsOrigins,
            credentials: true,
          }
        : true,
  });

  app.setGlobalPrefix("v1");
  const httpAdapter = app.getHttpAdapter();
  const httpServer = httpAdapter.getInstance?.();

  if (httpServer && typeof httpServer.set === "function") {
    httpServer.set("trust proxy", 1);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Sporza MVP API")
    .setDescription("API-first backend for the Sporza web-first MVP.")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, swaggerDocument);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  Logger.log(`API started on http://localhost:${port}/v1`, "Bootstrap");
}

void bootstrap();
