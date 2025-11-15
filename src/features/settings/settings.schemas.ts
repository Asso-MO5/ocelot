/**
 * Schémas de validation Fastify pour les paramètres du musée
 */

export const upsertSettingSchema = {
  body: {
    type: 'object',
    required: ['key', 'value'],
    properties: {
      key: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        description: 'Clé unique du paramètre (ex: "max_capacity", "current_visitors")',
      },
      value: {
        description: 'Valeur du paramètre (string, number, boolean ou object) - Le type est auto-détecté si value_type n\'est pas fourni',
      },
      description: {
        type: 'string',
        description: 'Description du paramètre',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        key: { type: 'string' },
        value: { type: ['string', 'number', 'boolean', 'object'] },
        description: { type: ['string', 'null'] },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
    },
    201: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        key: { type: 'string' },
        value: { type: ['string', 'number', 'boolean', 'object'] },
        description: { type: ['string', 'null'] },
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

export const getSettingsSchema = {
  querystring: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Filtrer par clé spécifique',
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
          key: { type: 'string' },
          value: { type: 'string' },
          value_type: { type: 'string' },
          description: { type: ['string', 'null'] },
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

export const getSettingByKeySchema = {
  params: {
    type: 'object',
    required: ['key'],
    properties: {
      key: {
        type: 'string',
        description: 'Clé du paramètre',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        key: { type: 'string' },
        value: { type: 'string' },
        value_type: { type: 'string' },
        description: { type: ['string', 'null'] },
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

export const deleteSettingSchema = {
  params: {
    type: 'object',
    required: ['key'],
    properties: {
      key: {
        type: 'string',
        description: 'Clé du paramètre à supprimer',
      },
    },
  },
  response: {
    204: {
      type: 'null',
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

export const getMaxCapacitySchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        max_capacity: {
          type: 'number',
          description: 'Capacité maximale du musée',
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

export const setMaxCapacitySchema = {
  body: {
    type: 'object',
    required: ['max_capacity'],
    properties: {
      max_capacity: {
        type: 'number',
        minimum: 0,
        description: 'Capacité maximale du musée (doit être positive ou nulle)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        key: { type: 'string' },
        value: { type: 'string' },
        value_type: { type: 'string' },
        description: { type: ['string', 'null'] },
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

export const getCurrentVisitorsSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        current_visitors: {
          type: 'number',
          description: 'Nombre actuel de visiteurs dans le musée',
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

export const setCurrentVisitorsSchema = {
  body: {
    type: 'object',
    required: ['current_visitors'],
    properties: {
      current_visitors: {
        type: 'number',
        minimum: 0,
        description: 'Nombre actuel de visiteurs (doit être positif ou nul)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        key: { type: 'string' },
        value: { type: 'string' },
        value_type: { type: 'string' },
        description: { type: ['string', 'null'] },
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

export const incrementVisitorsSchema = {
  body: {
    type: 'object',
    properties: {
      increment: {
        type: 'number',
        default: 1,
        description: 'Valeur d\'incrémentation (par défaut: 1)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        current_visitors: {
          type: 'number',
          description: 'Nouveau nombre de visiteurs après incrémentation',
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

export const decrementVisitorsSchema = {
  body: {
    type: 'object',
    properties: {
      decrement: {
        type: 'number',
        default: 1,
        description: 'Valeur de décrémentation (par défaut: 1)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        current_visitors: {
          type: 'number',
          description: 'Nouveau nombre de visiteurs après décrémentation',
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