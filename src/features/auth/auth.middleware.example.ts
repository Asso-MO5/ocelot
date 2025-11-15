/**
 * Exemples d'utilisation du middleware d'authentification
 * 
 * Ce fichier montre comment utiliser les middlewares d'authentification
 * et de vérification des rôles dans vos routes.
 */

import type { FastifyInstance } from 'fastify';
import { authenticateHook, requireRole, requireAnyRole, requireAllRoles } from './auth.middleware.ts';

/**
 * Exemple 1 : Route protégée nécessitant une authentification
 */
export function exampleProtectedRoute(app: FastifyInstance) {
  app.get('/example/protected', {
    preHandler: authenticateHook(app),
  }, async (req, reply) => {
    // req.user est maintenant disponible avec les données utilisateur
    return reply.send({
      message: `Bonjour ${req.user?.username}!`,
      userId: req.user?.id,
      roles: req.user?.roles,
    });
  });
}

/**
 * Exemple 2 : Route nécessitant un rôle spécifique (ex: admin)
 */
export function exampleAdminRoute(app: FastifyInstance) {
  app.get('/example/admin', {
    preHandler: [
      authenticateHook(app),
      requireRole('admin'),
    ],
  }, async (req, reply) => {
    return reply.send({
      message: 'Accès admin autorisé',
      user: req.user,
    });
  });
}

/**
 * Exemple 3 : Route nécessitant au moins un des rôles spécifiés
 */
export function exampleAnyRoleRoute(app: FastifyInstance) {
  app.get('/example/moderator-or-admin', {
    preHandler: [
      authenticateHook(app),
      requireAnyRole(['moderator', 'admin']),
    ],
  }, async (req, reply) => {
    return reply.send({
      message: 'Accès autorisé pour modérateur ou admin',
      user: req.user,
    });
  });
}

/**
 * Exemple 4 : Route nécessitant tous les rôles spécifiés
 */
export function exampleAllRolesRoute(app: FastifyInstance) {
  app.get('/example/super-admin', {
    preHandler: [
      authenticateHook(app),
      requireAllRoles(['admin', 'super-admin']),
    ],
  }, async (req, reply) => {
    return reply.send({
      message: 'Accès super-admin autorisé',
      user: req.user,
    });
  });
}

/**
 * Exemple 5 : Vérification manuelle des rôles dans le handler
 */
import { hasRole, hasAnyRole, hasAllRoles } from './auth.middleware.ts';

export function exampleManualCheckRoute(app: FastifyInstance) {
  app.get('/example/manual-check', {
    preHandler: authenticateHook(app),
  }, async (req, reply) => {
    if (!req.user) {
      return reply.code(401).send({ error: 'Non authentifié' });
    }

    // Vérifications manuelles
    const isAdmin = hasRole(req.user, 'admin');
    const isModOrAdmin = hasAnyRole(req.user, ['moderator', 'admin']);
    const isSuperAdmin = hasAllRoles(req.user, ['admin', 'super-admin']);

    return reply.send({
      user: req.user,
      checks: {
        isAdmin,
        isModOrAdmin,
        isSuperAdmin,
      },
    });
  });
}

