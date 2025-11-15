/**
 * Schémas de validation Fastify pour les créneaux horaires (slots)
 */

export const getSlotsSchema = {
  querystring: {
    type: 'object',
    required: ['date'],
    properties: {
      date: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: 'Date au format YYYY-MM-DD (ex: 2025-12-23)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date au format YYYY-MM-DD',
        },
        slots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              start_time: {
                type: 'string',
                description: 'Heure de début du créneau (HH:MM:SS)',
              },
              end_time: {
                type: 'string',
                description: 'Heure de fin du créneau (HH:MM:SS)',
              },
              capacity: {
                type: 'number',
                description: 'Capacité maximale du créneau',
              },
              booked: {
                type: 'number',
                description: 'Nombre de tickets réservés pour ce créneau',
              },
              available: {
                type: 'number',
                description: 'Nombre de places disponibles',
              },
              occupancy_percentage: {
                type: 'number',
                description: 'Pourcentage d\'occupation (0-100)',
              },
            },
            required: [
              'start_time',
              'end_time',
              'capacity',
              'booked',
              'available',
              'occupancy_percentage',
            ],
          },
        },
        total_capacity: {
          type: 'number',
          description: 'Capacité totale de la journée',
        },
        total_booked: {
          type: 'number',
          description: 'Nombre total de tickets réservés',
        },
        total_available: {
          type: 'number',
          description: 'Nombre total de places disponibles',
        },
      },
      required: ['date', 'slots', 'total_capacity', 'total_booked', 'total_available'],
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

