/**
 * Schémas de validation Fastify pour les tickets
 */

export const createTicketSchema = {
  body: {
    type: 'object',
    required: ['email', 'reservation_date', 'slot_start_time', 'slot_end_time', 'ticket_price'],
    properties: {
      first_name: {
        type: 'string',
        maxLength: 255,
        description: 'Prénom du visiteur (optionnel)',
      },
      last_name: {
        type: 'string',
        maxLength: 255,
        description: 'Nom du visiteur (optionnel)',
      },
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
        description: 'Email du visiteur (obligatoire pour recevoir le ticket)',
      },
      reservation_date: {
        type: 'string',
        format: 'date',
        description: 'Date de réservation (format YYYY-MM-DD)',
      },
      slot_start_time: {
        type: 'string',
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de début du créneau horaire (format HH:MM:SS)',
      },
      slot_end_time: {
        type: 'string',
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de fin du créneau horaire (format HH:MM:SS)',
      },
      ticket_price: {
        type: 'number',
        minimum: 0,
        description: 'Prix du ticket en euros',
      },
      donation_amount: {
        type: 'number',
        minimum: 0,
        default: 0,
        description: 'Montant du don optionnel en euros (0 par défaut)',
      },
      checkout_id: {
        type: 'string',
        description: 'ID du checkout SumUp (optionnel au moment de la création)',
      },
      checkout_reference: {
        type: 'string',
        description: 'Référence du checkout SumUp (optionnel)',
      },
      transaction_status: {
        type: 'string',
        description: 'Statut de la transaction SumUp (optionnel)',
      },
      notes: {
        type: 'string',
        description: 'Notes optionnelles',
      },
    },
  },
  response: {
    201: {
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

export const updateTicketSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID du ticket à mettre à jour',
      },
    },
  },
  body: {
    type: 'object',
    properties: {
      first_name: {
        type: ['string', 'null'],
        maxLength: 255,
        description: 'Prénom du visiteur',
      },
      last_name: {
        type: ['string', 'null'],
        maxLength: 255,
        description: 'Nom du visiteur',
      },
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
        description: 'Email du visiteur',
      },
      reservation_date: {
        type: 'string',
        format: 'date',
        description: 'Date de réservation (format YYYY-MM-DD)',
      },
      slot_start_time: {
        type: 'string',
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de début du créneau horaire (format HH:MM:SS)',
      },
      slot_end_time: {
        type: 'string',
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de fin du créneau horaire (format HH:MM:SS)',
      },
      ticket_price: {
        type: 'number',
        minimum: 0,
        description: 'Prix du ticket en euros',
      },
      donation_amount: {
        type: 'number',
        minimum: 0,
        description: 'Montant du don optionnel en euros',
      },
      checkout_id: {
        type: ['string', 'null'],
        description: 'ID du checkout SumUp',
      },
      checkout_reference: {
        type: ['string', 'null'],
        description: 'Référence du checkout SumUp',
      },
      transaction_status: {
        type: ['string', 'null'],
        description: 'Statut de la transaction SumUp',
      },
      status: {
        type: 'string',
        enum: ['pending', 'paid', 'cancelled', 'used', 'expired'],
        description: 'Statut du ticket',
      },
      used_at: {
        type: ['string', 'null'],
        format: 'date-time',
        description: 'Date/heure d\'utilisation du ticket',
      },
      notes: {
        type: ['string', 'null'],
        description: 'Notes optionnelles',
      },
    },
  },
  response: {
    200: {
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

export const getTicketsSchema = {
  querystring: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'Filtrer par email',
      },
      reservation_date: {
        type: 'string',
        format: 'date',
        description: 'Filtrer par date de réservation (format YYYY-MM-DD)',
      },
      status: {
        type: 'string',
        enum: ['pending', 'paid', 'cancelled', 'used', 'expired'],
        description: 'Filtrer par statut',
      },
      checkout_id: {
        type: 'string',
        description: 'Filtrer par checkout ID',
      },
      qr_code: {
        type: 'string',
        description: 'Filtrer par code QR',
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

export const getTicketByIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID du ticket',
      },
    },
  },
  response: {
    200: {
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

export const validateTicketSchema = {
  body: {
    type: 'object',
    required: ['qr_code'],
    properties: {
      qr_code: {
        type: 'string',
        minLength: 8,
        maxLength: 8,
        pattern: '^[A-Z0-9]{8}$',
        description: 'Code QR du ticket à valider (8 caractères alphanumériques majuscules)',
      },
    },
  },
  response: {
    200: {
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

export const createTicketsWithPaymentSchema = {
  body: {
    type: 'object',
    required: ['email', 'tickets'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
        description: 'Email commun pour tous les tickets (obligatoire)',
      },
      first_name: {
        type: 'string',
        maxLength: 255,
        description: 'Prénom commun pour tous les tickets (optionnel)',
      },
      last_name: {
        type: 'string',
        maxLength: 255,
        description: 'Nom commun pour tous les tickets (optionnel)',
      },
      tickets: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['reservation_date', 'slot_start_time', 'slot_end_time', 'ticket_price'],
          properties: {
            reservation_date: {
              type: 'string',
              format: 'date',
              description: 'Date de réservation (format YYYY-MM-DD)',
            },
            slot_start_time: {
              type: 'string',
              pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
              description: 'Heure de début du créneau horaire (format HH:MM:SS)',
            },
            slot_end_time: {
              type: 'string',
              pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
              description: 'Heure de fin du créneau horaire (format HH:MM:SS)',
            },
            ticket_price: {
              type: 'number',
              minimum: 0,
              description: 'Prix du ticket en euros',
            },
            donation_amount: {
              type: 'number',
              minimum: 0,
              default: 0,
              description: 'Montant du don optionnel en euros (0 par défaut)',
            },
            notes: {
              type: 'string',
              description: 'Notes optionnelles pour ce ticket',
            },
          },
        },
        description: 'Liste des tickets à créer (au moins 1 ticket requis)',
      },
      currency: {
        type: 'string',
        default: 'EUR',
        description: 'Devise pour le paiement (défaut: EUR)',
      },
      description: {
        type: 'string',
        description: 'Description du paiement (optionnel)',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        checkout_id: {
          type: 'string',
          description: 'ID du checkout SumUp',
        },
        checkout_reference: {
          type: 'string',
          description: 'Référence du checkout SumUp',
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
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          description: 'Liste des tickets créés',
        },
      },
      required: ['checkout_id', 'checkout_reference', 'tickets'],
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

export const getTicketsByCheckoutIdSchema = {
  params: {
    type: 'object',
    required: ['checkoutId'],
    properties: {
      checkoutId: {
        type: 'string',
        description: 'ID du checkout SumUp',
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

export const deleteTicketSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID du ticket à supprimer',
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

