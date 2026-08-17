import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
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

  // Security headers.
  //
  // The onboarding portal (OnboardNotifyPortalController) serves a real HTML
  // page with an inline <script> — helmet's default CSP (script-src 'self')
  // blocks any inline script outright, which made that page render as
  // silently blank rather than fail loudly. Rather than weaken script-src
  // app-wide with 'unsafe-inline', generate a per-request nonce and only
  // that exact <script> tag is allowed to run (see
  // onboard-notify-portal.controller.ts, which reads res.locals.cspNonce).
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.locals.cspNonce = randomBytes(16).toString('base64');
    next();
  });

  const isDev = process.env.NODE_ENV !== 'production';
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          scriptSrc: ["'self'", (_req: Request, res: Response) => `'nonce-${res.locals.cspNonce}'`],
          // Helmet's default upgrades every request on the page to https,
          // which is right for a real deployment but breaks a plain-HTTP
          // LAN dev server outright (favicon/asset loads and even page
          // navigation start failing with SSL errors). See helmet's own
          // README section on this exact issue.
          'upgrade-insecure-requests': isDev ? null : [],
        },
      },
      // Same reasoning: these only function over HTTPS or "localhost" and
      // are pure console noise (or breakage) against an LAN-IP http origin.
      hsts: !isDev,
      crossOriginOpenerPolicy: !isDev,
      originAgentCluster: !isDev,
    }),
  );

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
    .setDescription(
      'Human Resource Management System API.\n\n' +
        '**To try these endpoints:** POST `/auth/login` with one of the demo logins ' +
        '(`admin@hrms.com` / `hr@hrms.com` / `manager@hrms.com` / `employee@hrms.com`, ' +
        'password `Admin@123`), copy `access_token` from the response, click **Authorize** ' +
        'and paste it. Everything below is then exercised as that role — endpoints you ' +
        'lack the role for correctly return 403.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    // Keeps the pasted bearer token across page reloads — a docs-UI convenience
    // only; it changes nothing about how the API itself behaves.
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, tagsSorter: 'alpha' },
  });

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
