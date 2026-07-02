import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

// Process-level guards: a stray rejection/exception must NOT take the server down
// for every connected user. Log it and keep serving; let the orchestrator restart
// only on a truly fatal, repeated condition.
process.on('unhandledRejection', (reason) => {
  new Logger('Process').error(`Unhandled promise rejection: ${reason}`);
});
process.on('uncaughtException', (err) => {
  new Logger('Process').error(`Uncaught exception: ${err?.message}`, err?.stack);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // Security headers
  app.use(helmet());

  // gzip responses — big JSON list payloads over mobile networks compress well,
  // cutting bandwidth and time-to-last-byte under load.
  app.use(compression());

  // Bound request body size so a huge/malicious payload can't exhaust memory.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // CORS — restrict to configured origins in prod; allow all when unset (dev).
  const origins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : true, credentials: true });

  // Behind a load balancer/reverse proxy the client IP arrives in X-Forwarded-For.
  // Trust the first proxy hop so per-IP rate limiting keys off the real client
  // instead of treating every user as the single proxy IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const config = new DocumentBuilder()
    .setTitle('HRMS API')
    .setDescription('Human Resource Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Drain in-flight requests and close the DB pool cleanly on SIGTERM/SIGINT
  // (rolling deploys, autoscaler scale-down) instead of dropping live requests.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  const server = await app.listen(port);

  // Tune the underlying HTTP server for many concurrent keep-alive clients.
  // headersTimeout must exceed keepAliveTimeout to avoid spurious 502s behind
  // a proxy/load balancer.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 30_000;
  server.maxConnections = 10_000;

  console.log(`🚀 HRMS Backend running on http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
