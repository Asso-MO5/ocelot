/**
 * Schémas de validation Fastify pour les périodes spéciales
 */

export const createSpecialPeriodSchema = {
  body: {
    type: 'object',
    required: ['type', 'start_date', 'end_date'],
    properties: {
      type: {
        type: 'string',
        enum: ['holiday', 'closure'],
        description: 'Type de période : holiday (vacances) ou closure (fermeture)',
      },
      start_date: {
        type: 'string',
        format: 'date',
        description: 'Date de début (format YYYY-MM-DD)',
      },
      end_date: {
        type: 'string',
        format: 'date',
        description: 'Date de fin (format YYYY-MM-DD)',
      },
      name: {
        type: 'string',
        maxLength: 255,
        description: 'Nom de la période (ex: "Vacances de Noël 2024")',
      },
      description: {
        type: 'string',
        description: 'Description optionnelle',
      },
      zone: {
        type: 'string',
        maxLength: 50,
        description: 'Zone pour les vacances scolaires (ex: "A", "B", "C", "all"). Null pour les fermetures.',
      },
      is_active: {
        type: 'boolean',
        default: true,
        description: 'Indique si la période est active',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string', enum: ['holiday', 'closure'] },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        name: { type: ['string', 'null'] },
        description: { type: ['string', 'null'] },
        zone: { type: ['string', 'null'] },
        is_active: { type: 'boolean' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export const updateSpecialPeriodSchema = {
  body: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['holiday', 'closure'],
        description: 'Type de période : holiday (vacances) ou closure (fermeture)',
      },
      start_date: {
        type: 'string',
        format: 'date',
        description: 'Date de début (format YYYY-MM-DD)',
      },
      end_date: {
        type: 'string',
        format: 'date',
        description: 'Date de fin (format YYYY-MM-DD)',
      },
      name: {
        type: ['string', 'null'],
        maxLength: 255,
        description: 'Nom de la période',
      },
      description: {
        type: ['string', 'null'],
        description: 'Description optionnelle',
      },
      zone: {
        type: ['string', 'null'],
        maxLength: 50,
        description: 'Zone pour les vacances scolaires',
      },
      is_active: {
        type: 'boolean',
        description: 'Indique si la période est active',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string', enum: ['holiday', 'closure'] },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        name: { type: ['string', 'null'] },
        description: { type: ['string', 'null'] },
        zone: { type: ['string', 'null'] },
        is_active: { type: 'boolean' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export const getSpecialPeriodsSchema = {
  querystring: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['holiday', 'closure'],
        description: 'Filtrer par type',
      },
      date: {
        type: 'string',
        format: 'date',
        description: 'Vérifier si une date est dans une période spéciale (format YYYY-MM-DD)',
      },
      zone: {
        type: 'string',
        description: 'Filtrer par zone (pour les vacances scolaires)',
      },
      is_active: {
        type: 'boolean',
        description: 'Filtrer par statut actif',
      },
    },
  },
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['holiday', 'closure'] },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
          name: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          zone: { type: ['string', 'null'] },
          is_active: { type: 'boolean' },
          created_at: { type: 'string' },
          updated_at: { type: 'string' },
        },
      },
    },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

