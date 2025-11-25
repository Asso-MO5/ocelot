import type { FastifyInstance } from 'fastify';
import { handleError } from './error.service.ts';

/**
 * Enregistre les gestionnaires d'erreurs globaux pour Fastify
 */
export function registerErrorHandlers(app: FastifyInstance) {
  app.setErrorHandler(async (error, request, reply) => {
    const statusCode = error.statusCode || 500;

    if (error?.message?.match(/by CORS/)) {
      return reply.status(403).send({ error: 'Origin required in production' });
    }

    console.error(error);
    app.log.error({
      err: error,
      url: request.url,
      method: request.method,
      ip: request.ip,
    }, 'Erreur non gérée');

    if (statusCode >= 500 && !error.message.includes('Origin required')) {
      await handleError(app, error, {
        url: request.url,
        method: request.method,
        ip: request.ip,
        type: 'Route Error',
      });
    }

    let errorMessage = error.message;
    if (statusCode === 400 && (error as any).validation) {
      const validationErrors = (error as any).validation;
      if (validationErrors.length > 0) {
        const firstError = validationErrors[0];
        if (firstError.message === 'must be object' && firstError.instancePath === '') {
          errorMessage = 'Le body doit être un objet JSON valide avec Content-Type: application/json';
        } else {
          errorMessage = `Erreur de validation: ${validationErrors.map((e: any) => e.message).join(', ')}`;
        }
      }
    }

    reply.code(statusCode).send({
      error: errorMessage,
      statusCode,
    });
  });

  // Hook pour capturer les erreurs non gérées dans les hooks
  // Note: on ne traite pas l'erreur ici car setErrorHandler le fera déjà
  // Ce hook sert juste à logger les erreurs dans les hooks avant qu'elles ne soient gérées
  app.addHook('onError', async (request, reply, error) => {
    app.log.error({
      err: error,
      url: request.url,
      method: request.method,
    }, 'Erreur dans un hook');
    // L'erreur sera ensuite traitée par setErrorHandler
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

