/**
 * Schémas de validation Fastify pour les horaires
 */

export const createScheduleSchema = {
  body: {
    type: 'object',
    required: ['start_time', 'end_time', 'audience_type'],
    properties: {
      day_of_week: {
        type: 'integer',
        minimum: 0,
        maximum: 6,
        description: 'Jour de la semaine (0=dimanche, 1=lundi, ..., 6=samedi). Requis si is_exception est false.',
      },
      start_time: {
        type: 'string',
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de début au format HH:MM:SS',
      },
      end_time: {
        type: 'string',
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de fin au format HH:MM:SS',
      },
      audience_type: {
        type: 'string',
        enum: ['public', 'member'],
        description: 'Type d\'audience (public ou member)',
      },
      start_date: {
        type: 'string',
        format: 'date',
        description: 'Date de début pour les horaires spécifiques (format YYYY-MM-DD)',
      },
      end_date: {
        type: 'string',
        format: 'date',
        description: 'Date de fin pour les horaires spécifiques (format YYYY-MM-DD)',
      },
      is_exception: {
        type: 'boolean',
        default: false,
        description: 'Indique si c\'est une exception (vacances, fermeture exceptionnelle, etc.)',
      },
      is_closed: {
        type: 'boolean',
        default: false,
        description: 'Indique si le musée est fermé',
      },
      description: {
        type: 'string',
        description: 'Description de l\'exception ou du changement d\'horaire',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        day_of_week: { type: ['integer', 'null'] },
        start_time: { type: 'string' },
        end_time: { type: 'string' },
        audience_type: { type: 'string' },
        start_date: { type: ['string', 'null'] },
        end_date: { type: ['string', 'null'] },
        is_exception: { type: 'boolean' },
        is_closed: { type: 'boolean' },
        description: { type: ['string', 'null'] },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
      description: 'Horaire mis à jour (upsert)',
    },
    201: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        day_of_week: { type: ['integer', 'null'] },
        start_time: { type: 'string' },
        end_time: { type: 'string' },
        audience_type: { type: 'string' },
        start_date: { type: ['string', 'null'] },
        end_date: { type: ['string', 'null'] },
        is_exception: { type: 'boolean' },
        is_closed: { type: 'boolean' },
        description: { type: ['string', 'null'] },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
      description: 'Nouvel horaire créé (upsert)',
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

export const updateScheduleSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID de l\'horaire à mettre à jour',
      },
    },
  },
  body: {
    type: 'object',
    properties: {
      day_of_week: {
        type: ['integer', 'null'],
        minimum: 0,
        maximum: 6,
        description: 'Jour de la semaine (0=dimanche, 1=lundi, ..., 6=samedi)',
      },
      start_time: {
        type: 'string',
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de début au format HH:MM:SS',
      },
      end_time: {
        type: 'string',
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de fin au format HH:MM:SS',
      },
      audience_type: {
        type: 'string',
        enum: ['public', 'member'],
        description: 'Type d\'audience (public ou member)',
      },
      start_date: {
        type: ['string', 'null'],
        format: 'date',
        description: 'Date de début pour les horaires spécifiques (format YYYY-MM-DD)',
      },
      end_date: {
        type: ['string', 'null'],
        format: 'date',
        description: 'Date de fin pour les horaires spécifiques (format YYYY-MM-DD)',
      },
      is_exception: {
        type: 'boolean',
        description: 'Indique si c\'est une exception',
      },
      is_closed: {
        type: 'boolean',
        description: 'Indique si le musée est fermé',
      },
      description: {
        type: ['string', 'null'],
        description: 'Description de l\'exception ou du changement d\'horaire',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        day_of_week: { type: ['integer', 'null'] },
        start_time: { type: 'string' },
        end_time: { type: 'string' },
        audience_type: { type: 'string' },
        start_date: { type: ['string', 'null'] },
        end_date: { type: ['string', 'null'] },
        is_exception: { type: 'boolean' },
        is_closed: { type: 'boolean' },
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

export const getSchedulesSchema = {
  querystring: {
    type: 'object',
    properties: {
      day_of_week: {
        type: 'integer',
        minimum: 0,
        maximum: 6,
        description: 'Filtrer par jour de la semaine (0=dimanche, 1=lundi, ..., 6=samedi)',
      },
      audience_type: {
        type: 'string',
        enum: ['public', 'member'],
        description: 'Filtrer par type d\'audience',
      },
      date: {
        type: 'string',
        format: 'date',
        description: 'Récupérer les horaires pour une date spécifique (format YYYY-MM-DD)',
      },
      include_exceptions: {
        type: 'boolean',
        default: true,
        description: 'Inclure les exceptions dans les résultats',
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
          day_of_week: { type: ['integer', 'null'] },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
          audience_type: { type: 'string' },
          start_date: { type: ['string', 'null'] },
          end_date: { type: ['string', 'null'] },
          is_exception: { type: 'boolean' },
          is_closed: { type: 'boolean' },
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

export const getPublicSchedulesSchema = {
  querystring: {
    type: 'object',
    properties: {
      day_of_week: {
        type: 'integer',
        minimum: 0,
        maximum: 6,
        description: 'Filtrer par jour de la semaine (0=dimanche, 1=lundi, ..., 6=samedi)',
      },
      date: {
        type: 'string',
        format: 'date',
        description: 'Récupérer les horaires pour une date spécifique (format YYYY-MM-DD)',
      },
      include_exceptions: {
        type: 'boolean',
        default: true,
        description: 'Inclure les exceptions dans les résultats',
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
          day_of_week: { type: ['integer', 'null'] },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
          audience_type: { type: 'string' },
          start_date: { type: ['string', 'null'] },
          end_date: { type: ['string', 'null'] },
          is_exception: { type: 'boolean' },
          is_closed: { type: 'boolean' },
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

export const getScheduleByIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID de l\'horaire',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        day_of_week: { type: ['integer', 'null'] },
        start_time: { type: 'string' },
        end_time: { type: 'string' },
        audience_type: { type: 'string' },
        start_date: { type: ['string', 'null'] },
        end_date: { type: ['string', 'null'] },
        is_exception: { type: 'boolean' },
        is_closed: { type: 'boolean' },
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

export const deleteScheduleSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID de l\'horaire à supprimer',
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

