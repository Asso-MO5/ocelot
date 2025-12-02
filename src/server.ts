import fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import postgres from '@fastify/postgres';
import websocket from '@fastify/websocket';
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
import { registerWebSocketRoutes } from './features/websocket/websocket.ctrl.ts';
import { registerDonationProofRoutes } from './features/donation-proof/donation-proof.ctrl.ts';
import { sendToRoom } from './features/websocket/websocket.manager.ts';
import { registerErrorHandlers, registerProcessErrorHandlers } from './features/terror/error.handler.ts';
import { cancelExpiredPendingTickets } from './features/tickets/tickets.service.ts';

const logger = {
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    }
  }
};

const app = fastify({ logger });

app.addHook('onRequest', async (_req, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// Hook pour parser le JSON même si le Content-Type n'est pas correct
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const json = JSON.parse(body as string);
    done(null, json);
  } catch (err) {
    done(err as Error, undefined);
  }
});

app.addContentTypeParser('*', { parseAs: 'string' }, (req, body, done) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && body && typeof body === 'string') {
    const trimmed = (body as string).trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const json = JSON.parse(trimmed);
        done(null, json);
        return;
      } catch {
      }
    }
  }
  done(null, body);
});

const start = async () => {
  try {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [
      'http://localhost:3000'
    ];

    await app.register(websocket);

    let currentRequestUrl: string | null = null;    // Hook pour capturer l'URL de la requête avant le traitement CORS
    app.addHook('onRequest', async (request) => {
      currentRequestUrl = request.url;
    });
    await app.register(cors, {
      origin: (origin, callback) => {
        // Extraire le pathname sans les query parameters
        const pathname = currentRequestUrl ? currentRequestUrl.split('?')[0] : null;
        // Routes qui peuvent être appelées sans origin même en production
        const isPublicRoute = pathname && (
          pathname === '/auth/signin' ||
          pathname === '/auth/callback' ||
          pathname.startsWith('/docs') ||
          pathname === '/museum/schedules/public' ||
          pathname === '/pay/webhook' ||
          pathname === '/museum/slots' ||
          pathname.startsWith('/tickets/')
        );

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
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Set-Cookie'],
      maxAge: 86400
    });

    registerErrorHandlers(app);
    registerWebSocketRoutes(app);

    (app as any).ws = { send: sendToRoom };
    registerAuthRoutes(app);
    registerDocsRoutes(app);
    registerPayRoutes(app);
    registerSchedulesRoutes(app);
    registerPricesRoutes(app);
    registerTicketsRoutes(app);
    registerSettingsRoutes(app);
    registerSlotsRoutes(app);
    registerDonationProofRoutes(app);

    await app.register(cookie, {
      secret: process.env.COOKIE_SECRET || 'your-secret-key-change-in-production',
      parseOptions: {}
    });

    app.log.info('✅ Plugin WebSocket enregistré');

    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      await app.register(postgres, {
        connectionString: databaseUrl,
      });
      app.log.info('✅ Connexion PostgreSQL établie');
    } else {
      app.log.warn('⚠️  DATABASE_URL non configuré, la base de données ne sera pas disponible');
    }

    // Configurer la tâche périodique pour nettoyer les tickets pending expirés
    // S'exécute toutes les minutes
    if (app.pg) {

      const cleanupTask = new AsyncTask(
        'cleanup-expired-pending-tickets',
        async () => {
          try {
            const cancelledCount = await cancelExpiredPendingTickets(app);
            if (cancelledCount > 0) {
              // Notifier via WebSocket que les statistiques ont changé
              (app.ws as any).send('tickets_stats', 'refetch');
              (app.ws as any).send('slots', 'refetch');
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
      // Attendre que l'app soit prête avant d'ajouter le job
      await app.ready();
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