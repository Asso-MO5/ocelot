import type { FastifySchema } from 'fastify';

/**
 * Schémas de validation et sérialisation Fastify pour les routes d'authentification
 * Basés sur JSON Schema Draft 7
 */

/**
 * Schéma pour les paramètres de query du callback OAuth2
 */
export const callbackQuerySchema = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: 'Code d\'autorisation retourné par Discord',
    },
    error: {
      type: 'string',
      description: 'Code d\'erreur retourné par Discord',
    },
    state: {
      type: 'string',
      description: 'État passé lors de la requête initiale',
    },
  },
} as const;

/**
 * Schéma de réponse pour /auth/session
 */
export const sessionResponseSchema = {
  type: 'object',
  properties: {
    authenticated: {
      type: 'boolean',
      description: 'Indique si l\'utilisateur est authentifié',
    },
    hasRefreshToken: {
      type: 'boolean',
      description: 'Indique si un refresh token est disponible',
    },
  },
  required: ['authenticated', 'hasRefreshToken'],
} as const;

/**
 * Schéma de réponse pour /auth/me (succès)
 */
export const meResponseSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'ID unique de l\'utilisateur Discord',
    },
    username: {
      type: 'string',
      description: 'Nom d\'utilisateur',
    },
    discriminator: {
      type: 'string',
      description: 'Discriminator (4 chiffres)',
    },
    avatar: {
      type: ['string', 'null'],
      description: 'Hash de l\'avatar ou null',
    },
    email: {
      type: 'string',
      description: 'Email de l\'utilisateur (si le scope email est accordé)',
    },
  },
  required: ['id', 'username', 'discriminator', 'avatar'],
} as const;

/**
 * Schéma de réponse d'erreur générique
 */
export const errorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      description: 'Message d\'erreur',
    },
  },
  required: ['error'],
} as const;

/**
 * Schéma complet pour la route /auth/callback
 */
export const callbackSchema: FastifySchema = {
  querystring: callbackQuerySchema,
  // Pas de réponse car c'est une redirection
} as const;

/**
 * Schéma complet pour la route /auth/session
 */
export const sessionSchema: FastifySchema = {
  response: {
    200: sessionResponseSchema,
  },
} as const;

/**
 * Schéma complet pour la route /auth/me
 */
export const meSchema: FastifySchema = {
  response: {
    200: meResponseSchema,
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
} as const;

/**
 * Schéma complet pour les routes /auth/signin et /auth/login
 * Pas de validation nécessaire car ce sont des redirections
 */
export const signinSchema: FastifySchema = {
  response: {
    302: {
      type: 'null',
      description: 'Redirection vers Discord OAuth2',
    },
    500: errorResponseSchema,
  },
} as const;

