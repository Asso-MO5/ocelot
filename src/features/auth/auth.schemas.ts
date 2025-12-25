import type { FastifySchema } from 'fastify';

const callbackQuerySchema = {
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

const meResponseSchema = {
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
    roles: {
      type: 'array',
      description: 'Rôles de l\'utilisateur',
      items: {
        type: 'string',
        description: 'Nom du rôle',
      },
    },
  },
  required: ['id', 'username', 'discriminator', 'avatar', 'roles'],
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
      description: 'Redirection vers Discord OAuth2',
    },
    500: errorResponseSchema,
  },
} as const;

