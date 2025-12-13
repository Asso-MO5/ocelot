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
        description: 'ID du checkout (optionnel au moment de la création)',
      },
      checkout_reference: {
        type: 'string',
        description: 'Référence du checkout (optionnel)',
      },
      transaction_status: {
        type: 'string',
        description: 'Statut de la transaction (optionnel)',
      },
      notes: {
        type: 'string',
        description: 'Notes libres optionnelles. Si pricing_info est fourni, il sera automatiquement stocké dans notes au format JSON avec les notes libres.',
      },
      pricing_info: {
        type: 'object',
        description: 'Informations de tarif au moment de la création (sera stocké dans notes au format JSON). Permet de conserver les informations de tarif pour vérification ultérieure, notamment pour les membres avec places gratuites.',
        properties: {
          price_id: {
            type: ['string', 'null'],
            format: 'uuid',
            description: 'ID du tarif utilisé (optionnel, peut être null pour les tarifs personnalisés)',
          },
          price_name: {
            type: ['string', 'null'],
            description: 'Nom du tarif au moment de la création (pour référence)',
          },
          price_amount: {
            type: 'number',
            minimum: 0,
            description: 'Montant du tarif au moment de la création',
          },
          audience_type: {
            type: ['string', 'null'],
            enum: ['public', 'member'],
            description: 'Type d\'audience',
          },
          requires_proof: {
            type: ['boolean', 'null'],
            description: 'Si un justificatif était requis',
          },
          proof_info: {
            type: ['object', 'null'],
            description: 'Informations sur le justificatif fourni',
            properties: {
              type: {
                type: ['string', 'null'],
                description: 'Type de justificatif (ex: "student_card", "senior_card", "member_card")',
              },
              reference: {
                type: ['string', 'null'],
                description: 'Référence du justificatif (numéro de carte, etc.)',
              },
              uploaded_at: {
                type: ['string', 'null'],
                format: 'date-time',
                description: 'Date d\'upload du justificatif (format ISO)',
              },
              verified: {
                type: ['boolean', 'null'],
                description: 'Si le justificatif a été vérifié',
              },
              verified_by: {
                type: ['string', 'null'],
                description: 'ID ou nom de la personne qui a vérifié',
              },
              verified_at: {
                type: ['string', 'null'],
                format: 'date-time',
                description: 'Date de vérification (format ISO)',
              },
            },
          },
          applied_at: {
            type: 'string',
            format: 'date-time',
            default: new Date().toISOString(),
            description: 'Date d\'application du tarif (format ISO). Générée automatiquement si non fournie.',
          },
        },
        required: ['price_amount'],
      },
      language: {
        type: 'string',
        maxLength: 10,
        description: 'Code de langue (ex: "fr", "en", "es")',
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
        guided_tour_price: { type: 'number' },
        total_amount: { type: 'number' },
        status: { type: 'string' },
        used_at: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
        language: { type: ['string', 'null'] },
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
        description: 'ID du checkout',
      },
      checkout_reference: {
        type: ['string', 'null'],
        description: 'Référence du checkout',
      },
      transaction_status: {
        type: ['string', 'null'],
        description: 'Statut de la transaction',
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
      language: {
        type: ['string', 'null'],
        maxLength: 10,
        description: 'Code de langue (ex: "fr", "en", "es")',
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
        guided_tour_price: { type: 'number' },
        total_amount: { type: 'number' },
        status: { type: 'string' },
        used_at: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
        language: { type: ['string', 'null'] },
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
      search: {
        type: 'string',
        description: 'Recherche textuelle dans email, first_name, last_name, checkout_id, checkout_reference et qr_code (insensible à la casse, recherche partielle). Exemple: "gmail" trouvera tous les tickets avec un email contenant "gmail".',
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
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
        description: 'Numéro de page (commence à 1, par défaut 1)',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        default: 500,
        description: 'Nombre d\'éléments par page (par défaut 500)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
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
        },
        total: {
          type: 'integer',
          description: 'Nombre total de tickets correspondant aux filtres',
        },
        page: {
          type: 'integer',
          description: 'Page actuelle',
        },
        limit: {
          type: 'integer',
          description: 'Nombre d\'éléments par page',
        },
        totalPages: {
          type: 'integer',
          description: 'Nombre total de pages',
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
        guided_tour_price: { type: 'number' },
        total_amount: { type: 'number' },
        status: { type: 'string' },
        used_at: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
        language: { type: ['string', 'null'] },
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
        guided_tour_price: { type: 'number' },
        total_amount: { type: 'number' },
        status: { type: 'string' },
        used_at: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
        language: { type: ['string', 'null'] },
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
    required: ['tickets', 'success_url', 'cancel_url'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
        description: 'Email commun pour tous les tickets (obligatoire uniquement si tous les tickets sont gratuites, sinon Stripe le récupère)',
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
      language: {
        type: 'string',
        maxLength: 10,
        description: 'Code de langue commun pour tous les tickets (ex: "fr", "en", "es")',
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
              description: 'Notes libres optionnelles pour ce ticket. Si pricing_info est fourni, il sera automatiquement stocké dans notes au format JSON avec les notes libres.',
            },
            pricing_info: {
              type: 'object',
              description: 'Informations de tarif au moment de la création pour ce ticket (sera stocké dans notes au format JSON). Permet de conserver les informations de tarif pour vérification ultérieure, notamment pour les membres avec places gratuites.',
              properties: {
                price_id: {
                  type: ['string', 'null'],
                  format: 'uuid',
                  description: 'ID du tarif utilisé (optionnel, peut être null pour les tarifs personnalisés)',
                },
                price_name: {
                  type: ['string', 'null'],
                  description: 'Nom du tarif au moment de la création (pour référence)',
                },
                price_amount: {
                  type: 'number',
                  minimum: 0,
                  description: 'Montant du tarif au moment de la création',
                },
                audience_type: {
                  type: ['string', 'null'],
                  enum: ['public', 'member'],
                  description: 'Type d\'audience',
                },
                requires_proof: {
                  type: ['boolean', 'null'],
                  description: 'Si un justificatif était requis',
                },
                proof_info: {
                  type: ['object', 'null'],
                  description: 'Informations sur le justificatif fourni',
                  properties: {
                    type: {
                      type: ['string', 'null'],
                      description: 'Type de justificatif (ex: "student_card", "senior_card", "member_card")',
                    },
                    reference: {
                      type: ['string', 'null'],
                      description: 'Référence du justificatif (numéro de carte, etc.)',
                    },
                    uploaded_at: {
                      type: ['string', 'null'],
                      format: 'date-time',
                      description: 'Date d\'upload du justificatif (format ISO)',
                    },
                    verified: {
                      type: ['boolean', 'null'],
                      description: 'Si le justificatif a été vérifié',
                    },
                    verified_by: {
                      type: ['string', 'null'],
                      description: 'ID ou nom de la personne qui a vérifié',
                    },
                    verified_at: {
                      type: ['string', 'null'],
                      format: 'date-time',
                      description: 'Date de vérification (format ISO)',
                    },
                  },
                },
                applied_at: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Date d\'application du tarif (format ISO). Générée automatiquement si non fournie.',
                },
              },
              required: ['price_amount', 'applied_at'],
            },
          },
        },
        description: 'Liste des tickets à créer (au moins 1 ticket requis)',
      },
      gift_codes: {
        type: 'array',
        items: {
          type: 'string',
          pattern: '^[A-Z0-9]{12}$',
          description: 'Code cadeau (12 caractères alphanumériques majuscules)',
        },
        description: 'Tableau de codes cadeaux à utiliser (optionnel). Chaque code offre une place gratuite, appliquée aux tickets les plus chers en premier.',
      },
      guided_tour: {
        type: 'boolean',
        default: false,
        description: 'true si le visiteur souhaite une visite guidée (optionnel, false par défaut)',
      },
      guided_tour_price: {
        type: 'number',
        minimum: 0,
        description: 'Prix de la visite guidée (optionnel, sera récupéré depuis les settings si non fourni). Doit correspondre au tarif configuré dans les settings.',
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
      success_url: {
        type: 'string',
        format: 'uri',
        description: 'URL de redirection après paiement réussi (obligatoire). Doit contenir {CHECKOUT_SESSION_ID} qui sera remplacé par Stripe.',
      },
      cancel_url: {
        type: 'string',
        format: 'uri',
        description: 'URL de redirection en cas d\'annulation (obligatoire)',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        checkout_id: {
          type: ['string', 'null'],
          description: 'ID du checkout (null si la commande est gratuite)',
        },
        checkout_reference: {
          type: ['string', 'null'],
          description: 'Référence du checkout (null si la commande est gratuite)',
        },
        checkout_url: {
          type: ['string', 'null'],
          format: 'uri',
          description: 'URL de redirection vers la page de paiement (null si la commande est gratuite)',
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
          description: 'Liste des tickets créés',
        },
      },
      required: ['tickets'],
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
        description: 'ID du checkout',
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
          language: { type: ['string', 'null'] },
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

export const getTicketsStatsSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        tickets_stats: {
          type: 'object',
          properties: {
            total_tickets_sold: {
              type: 'number',
              description: 'Nombre total de tickets vendus (status = paid)',
            },
            week_tickets_sold: {
              type: 'number',
              description: 'Nombre de tickets vendus cette semaine',
            },
            week_tickets_by_day: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: {
                    type: 'string',
                    description: 'Date au format YYYY-MM-DD',
                  },
                  day_name: {
                    type: 'string',
                    description: 'Nom du jour (lundi, mardi, etc.)',
                  },
                  tickets_count: {
                    type: 'number',
                    description: 'Nombre de tickets vendus ce jour',
                  },
                  amount: {
                    type: 'number',
                    description: 'Montant total des tickets vendus ce jour',
                  },
                },
                required: ['date', 'day_name', 'tickets_count', 'amount'],
              },
              description: 'Répartition des tickets vendus par jour de la semaine',
            },
            total_amount: {
              type: 'number',
              description: 'Montant total de tous les tickets vendus',
            },
            week_amount: {
              type: 'number',
              description: 'Montant total des tickets vendus cette semaine',
            },
            month_amount: {
              type: 'number',
              description: 'Montant total des tickets vendus ce mois',
            },
          },
          required: [
            'total_tickets_sold',
            'week_tickets_sold',
            'week_tickets_by_day',
            'total_amount',
            'week_amount',
            'month_amount',
          ],
        },
      },
      required: ['tickets_stats'],
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

