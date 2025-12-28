export const upsertPresenceSchema = {
  body: {
    type: 'object',
    required: ['date', 'period'],
    properties: {
      date: {
        type: 'string',
        format: 'date',
        description: 'Date de présence (format YYYY-MM-DD)',
      },
      period: {
        type: 'string',
        enum: ['morning', 'afternoon', 'both'],
        description: 'Période de présence : matin, après-midi, ou les deux',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        user_id: { type: 'string', format: 'uuid' },
        user_name: { type: 'string' },
        date: { type: 'string', format: 'date' },
        period: { type: 'string', enum: ['morning', 'afternoon', 'both'] },
        refused_by_admin: { type: 'boolean' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  },
};

export const getPresencesSchema = {
  querystring: {
    type: 'object',
    required: ['start_date'],
    properties: {
      start_date: {
        type: 'string',
        format: 'date',
        description: 'Date de début (format YYYY-MM-DD)',
      },
      end_date: {
        type: 'string',
        format: 'date',
        description: 'Date de fin (optionnel, par défaut = start_date)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        days: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', format: 'date' },
              day_name: { type: 'string' },
              is_open: { type: 'boolean' },
              presences: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    user_id: { type: 'string', format: 'uuid' },
                    user_name: { type: 'string' },
                    date: { type: 'string', format: 'date' },
                    period: { type: 'string', enum: ['morning', 'afternoon', 'both'] },
                    refused_by_admin: { type: 'boolean' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
        start_date: { type: 'string', format: 'date' },
        end_date: { type: 'string', format: 'date' },
      },
    },
  },
};

export const refusePresenceSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID de la présence',
      },
    },
  },
  body: {
    type: 'object',
    required: ['refused'],
    properties: {
      refused: {
        type: 'boolean',
        description: 'true pour refuser, false pour accepter',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        user_id: { type: 'string', format: 'uuid' },
        user_name: { type: 'string' },
        date: { type: 'string', format: 'date' },
        period: { type: 'string', enum: ['morning', 'afternoon', 'both'] },
        refused_by_admin: { type: 'boolean' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  },
};

export const deletePresenceSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID de la présence',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
  },
};

