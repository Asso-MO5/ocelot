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

export const getValidatedTicketsBySlotSchema = {
  querystring: {
    type: 'object',
    required: ['reservation_date', 'slot_start_time', 'slot_end_time'],
    properties: {
      reservation_date: {
        type: 'string',
        format: 'date',
        description: 'Date de réservation (format YYYY-MM-DD)',
      },
      slot_start_time: {
        type: 'string',
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de début du créneau (format HH:MM:SS)',
      },
      slot_end_time: {
        type: 'string',
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de fin du créneau (format HH:MM:SS)',
      },
      include_adjacent_slots: {
        type: 'boolean',
        default: true,
        description: 'Inclure les créneaux adjacents (par défaut: true)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Nombre de tickets validés pour le créneau',
        },
        tickets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              qr_code: { type: 'string' },
              first_name: { type: ['string', 'null'] },
              last_name: { type: ['string', 'null'] },
              email: { type: 'string' },
              reservation_date: { type: 'string' },
              slot_start_time: { type: 'string' },
              slot_end_time: { type: 'string' },
              checkout_id: { type: ['string', 'null'] },
              checkout_reference: { type: ['string', 'null'] },
              transaction_status: { type: ['string', 'null'] },
              ticket_price: { type: 'number' },
              donation_amount: { type: 'number' },
              total_amount: { type: 'number' },
              status: { type: 'string' },
              used_at: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
              language: { type: ['string', 'null'] },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          description: 'Liste des tickets validés pour le créneau',
        },
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