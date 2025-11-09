import type { FastifyInstance } from 'fastify';
import { handleError } from './error.service.ts';

/**
 * Enregistre les gestionnaires d'erreurs globaux pour Fastify
 */
export function registerErrorHandlers(app: FastifyInstance) {
  // Gestionnaire d'erreurs global pour les routes
  app.setErrorHandler(async (error, request, reply) => {
    // Logger l'erreur localement
    app.log.error({
      err: error,
      url: request.url,
      method: request.method,
      ip: request.ip,
    }, 'Erreur non gérée');

    // Traiter l'erreur (sauvegarde + Discord)
    await handleError(app, error, {
      url: request.url,
      method: request.method,
      ip: request.ip,
      type: 'Route Error',
    });

    const statusCode = error.statusCode || 500;

    reply.code(statusCode).send({
      error: error.message,
      statusCode,
    });
  });

  // Hook pour capturer les erreurs non gérées dans les hooks
  app.addHook('onError', async (request, reply, error) => {
    // Logger l'erreur localement
    app.log.error({
      err: error,
      url: request.url,
      method: request.method,
    }, 'Erreur dans un hook');

    // Traiter l'erreur (sauvegarde + Discord)
    await handleError(app, error, {
      url: request.url,
      method: request.method,
      ip: request.ip,
      type: 'Hook Error',
    });
  });
}

/**
 * Enregistre les gestionnaires d'erreurs pour les processus Node.js
 */
export function registerProcessErrorHandlers(app: FastifyInstance, shutdown: () => Promise<void>) {
  // Gestionnaire pour les promesses rejetées non capturées
  process.on('unhandledRejection', async (reason, promise) => {
    app.log.error({ err: reason, promise }, 'Unhandled Rejection');

    const error = reason instanceof Error ? reason : new Error(String(reason));

    await handleError(app, error, {
      type: 'Unhandled Rejection',
    });

    if (process.env.NODE_ENV === 'production') {
      return;
    }
  });

  // Gestionnaire pour les exceptions non capturées
  process.on('uncaughtException', async (error) => {
    app.log.error({ err: error }, 'Uncaught Exception');

    await handleError(app, error, {
      type: 'Uncaught Exception',
    });

    await shutdown();
  });
}

