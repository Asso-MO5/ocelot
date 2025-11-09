import fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import postgres from '@fastify/postgres';
import { registerAuthRoutes } from './features/auth/auth.ctrl.ts';
import { registerDocsRoutes } from './features/docs/docs.ctrl.ts';
import { registerErrorHandlers, registerProcessErrorHandlers } from './features/terror/error.handler.ts';

const app = fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      }
    }
  },
});

app.addHook('onRequest', async (_req, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// Enregistrer les gestionnaires d'erreurs
registerErrorHandlers(app);

registerAuthRoutes(app);
registerDocsRoutes(app);

const start = async () => {
  try {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [
      'http://localhost:3000',
      'http://localhost:4000'
    ];

    await app.register(cors, {
      origin: (origin, callback) => {
        if (!origin) {
          if (process.env.NODE_ENV === 'production') {
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

    await app.register(cookie, {
      secret: process.env.COOKIE_SECRET || 'your-secret-key-change-in-production',
      parseOptions: {}
    });

    // Configuration PostgreSQL
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      await app.register(postgres, {
        connectionString: databaseUrl,
      });
      app.log.info('✅ Connexion PostgreSQL établie');
    } else {
      app.log.warn('⚠️  DATABASE_URL non configuré, la base de données ne sera pas disponible');
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

// Enregistrer les gestionnaires d'erreurs pour les processus Node.js
registerProcessErrorHandlers(app, shutdown);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();