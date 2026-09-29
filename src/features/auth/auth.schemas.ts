import type { FastifySchema } from 'fastify';

const callbackQuerySchema = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: 'Code d\'autorisation retourné par Zitadel',
    },
    error: {
      type: 'string',
      description: 'Code d\'erreur retourné par Zitadel',
    },
    state: {
      type: 'string',
      description: 'État passé lors de la requête initiale',
    },
  },
} as const;

const meResponseSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'ID interne ou subject Zitadel de l\'utilisateur',
    },
    username: {
      type: 'string',
      description: 'Nom d\'utilisateur',
    },
    avatar: {
      type: ['string', 'null'],
      description: 'URL de l\'avatar ou null',
    },
    email: {
      type: 'string',
      description: 'Email de l\'utilisateur (si le scope email est accordé)',
    },
    roles: {
      type: 'array',
      description: 'Rôles de l\'utilisateur',
      items: {
        type: 'string',
        description: 'Nom du rôle',
      },
    },
  },
  required: ['id', 'username', 'avatar', 'roles'],
} as const;

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      description: 'Message d\'erreur',
    },
  },
  required: ['error'],
} as const;

export const callbackSchema: FastifySchema = {
  querystring: callbackQuerySchema,
} as const;

export const meSchema: FastifySchema = {
  response: {
    200: meResponseSchema,
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
} as const;

export const signinSchema: FastifySchema = {
  response: {
    302: {
      type: 'null',
      description: 'Redirection vers Zitadel OpenID Connect',
    },
    500: errorResponseSchema,
  },
} as const;

const signoutResponseSchema = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indique si la déconnexion a réussi',
    },
  },
  required: ['success'],
} as const;

export const signoutSchema: FastifySchema = {
  response: {
    200: signoutResponseSchema,
  },
} as const;
