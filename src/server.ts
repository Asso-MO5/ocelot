import fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import postgres from '@fastify/postgres';
import fastifySchedule from '@fastify/schedule';
import { SimpleIntervalJob, AsyncTask } from 'toad-scheduler';

import { registerAuthRoutes } from './features/auth/auth.ctrl.ts';
import { registerDocsRoutes } from './features/docs/docs.ctrl.ts';
import { registerPayRoutes } from './features/pay/pay.ctrl.ts';
import { registerSchedulesRoutes } from './features/schedules/schedules.ctrl.ts';
import { registerPricesRoutes } from './features/prices/prices.ctrl.ts';
import { registerTicketsRoutes } from './features/tickets/tickets.ctrl.ts';
import { registerSettingsRoutes } from './features/settings/settings.ctrl.ts';
import { registerSlotsRoutes } from './features/slots/slots.ctrl.ts';
import { registerDonationProofRoutes } from './features/donation-proof/donation-proof.ctrl.ts';
import { registerGiftCodesRoutes } from './features/gift-codes/gift-codes.ctrl.ts';
import { registerSpecialPeriodsRoutes } from './features/special-periods/special-periods.ctrl.ts';
import { registerEventsRoutes } from './features/events/events.ctrl.ts';
import { registerMemberPresencesRoutes } from './features/member-presences/member-presences.ctrl.ts';
import { sendToRoom } from './features/websocket/websocket.manager.ts';
import { registerErrorHandlers, registerProcessErrorHandlers } from './features/terror/error.handler.ts';
import { cancelExpiredPendingTickets } from './features/tickets/tickets.service.ts';

const logger = process.env.NODE_ENV === 'production'
  ? { level: 'info' }
  : {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
    };

const app = fastify({ logger });

app.addHook('onRequest', async (_req, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});


/**
 * Pour Stripe, préserver le Buffer brut pour la vérification de signature
 */
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  if (req.url === '/pay/webhook') {
    (req as any).rawBody = body;
    try {
      const json = JSON.parse(body.toString('utf-8'));
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
    return;
  }

  const bodyString = body.toString('utf-8');
  (req as any).rawBody = bodyString;

  if (!bodyString.trim()) {
    done(null, undefined);
    return;
  }

  try {
    const json = JSON.parse(bodyString);
    done(null, json);
  } catch (err) {
    done(err as Error, undefined);
  }
});

app.addContentTypeParser('*', { parseAs: 'buffer' }, (req, body, done) => {
  if (req.url === '/pay/webhook') {
    if (!(req as any).rawBody) {
      (req as any).rawBody = body;
    }
    try {
      const json = JSON.parse(body.toString('utf-8'));
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
    return;
  }

  const bodyString = body.toString('utf-8');
  if (!(req as any).rawBody) {
    (req as any).rawBody = bodyString;
  }

  if (['POST', 'PUT', 'PATCH'].includes(req.method) && bodyString) {
    const trimmed = bodyString.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const json = JSON.parse(trimmed);
        done(null, json);
        return;
      } catch {
      }
    }
  }
  done(null, bodyString);
});

const start = async () => {
  try {

    const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [
      'http://localhost:3000'
    ];


    let currentRequestUrl: string | null = null;
    app.addHook('onRequest', async (request) => {
      currentRequestUrl = request.url;
    });
    await app.register(cors, {
      origin: (origin, callback) => {
        const pathname = currentRequestUrl ? currentRequestUrl.split('?')[0] : null;

        const publicRoutes = [
          '/auth/signin',
          '/auth/signout',
          '/auth/callback',
          '/museum/schedules/public',
          '/pay/webhook',
          '/museum/slots',
        ];

        // Routes de documentation : toutes les routes commençant par /docs
        const isDocsRoute = pathname && pathname.startsWith('/docs');
        const isPublicRoute = pathname && (publicRoutes.includes(pathname) || isDocsRoute);

        if (!origin) {
          if (process.env.NODE_ENV === 'production' && !isPublicRoute) {
            callback(new Error('Origin required in production'), false);
            return;
          }

          callback(null, true);
          return;
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          app.log.warn(`CORS bloqué pour l'origine: ${origin}. Origines autorisées: ${allowedOrigins.join(', ')}`);
          callback(new Error('Not allowed by CORS'), false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Upgrade', 'Connection', 'Sec-WebSocket-Key', 'Sec-WebSocket-Version', 'Sec-WebSocket-Extensions', 'Sec-WebSocket-Protocol'],
      exposedHeaders: ['Set-Cookie'],
      maxAge: 86400
    });

    registerErrorHandlers(app);

    registerAuthRoutes(app);
    registerDocsRoutes(app);
    registerPayRoutes(app);
    registerSchedulesRoutes(app);
    registerPricesRoutes(app);
    registerTicketsRoutes(app);
    registerSettingsRoutes(app);
    registerSlotsRoutes(app);
    registerDonationProofRoutes(app);
    registerGiftCodesRoutes(app);
    registerSpecialPeriodsRoutes(app);
    registerEventsRoutes(app);
    registerMemberPresencesRoutes(app);

    await app.register(cookie, {
      secret: process.env.COOKIE_SECRET || 'your-secret-key-change-in-production',
      parseOptions: {}
    });


    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      await app.register(postgres, {
        connectionString: databaseUrl,
      });
      app.log.info('✅ Connexion PostgreSQL établie');
    } else {
      app.log.warn('⚠️  DATABASE_URL non configuré, la base de données ne sera pas disponible');
    }

    if (app.pg) {


      const cleanupTask = new AsyncTask(
        'cleanup-expired-pending-tickets',
        async () => {
          try {
            const cancelledCount = await cancelExpiredPendingTickets(app);
            if (cancelledCount > 0) {
              sendToRoom('tickets_stats', 'refetch');
              sendToRoom('slots', 'refetch');
            }
          } catch (err) {
            app.log.error({ err }, 'Erreur lors du nettoyage des tickets expirés');
          }
        },
        (err) => {
          app.log.error({ err }, 'Erreur dans la tâche de nettoyage des tickets expirés');
        }
      );

      const cleanupJob = new SimpleIntervalJob({ minutes: 15 }, cleanupTask);

      await app.register(fastifySchedule);
      await app.ready();

      // CRON TASKS 
      app.scheduler.addSimpleIntervalJob(cleanupJob);

      app.log.info('✅ Tâche de nettoyage des tickets pending expirés configurée (toutes les minutes)');
    }

    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({
      port,
      host,
      listenTextResolver: () => {
        return `http://${host}:${port}`;
      }
    });

    app.log.info(`🚀 Serveur HTTP démarré sur http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const shutdown = async () => {
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'Erreur lors de l\'arrêt');
    process.exit(1);
  }
};

registerProcessErrorHandlers(app, shutdown);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
