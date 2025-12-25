export const createGiftCodePackSchema = {
  body: {
    type: 'object',
    required: ['quantity'],
    properties: {
      quantity: {
        type: 'integer',
        minimum: 1,
        maximum: 1000,
        description: 'Nombre de codes cadeaux à créer',
      },
      pack_name: {
        type: 'string',
        maxLength: 255,
        description: 'Nom du pack (optionnel)',
      },
      expires_at: {
        type: 'string',
        format: 'date-time',
        description: 'Date d\'expiration des codes (optionnelle, format ISO)',
      },
      notes: {
        type: 'string',
        description: 'Notes optionnelles pour le pack',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        pack_id: { type: 'string' },
        codes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              code: { type: 'string' },
              status: { type: 'string', enum: ['unused', 'used', 'expired'] },
              ticket_id: { type: ['string', 'null'] },
              pack_id: { type: ['string', 'null'] },
              recipient_email: { type: ['string', 'null'] },
              expires_at: { type: ['string', 'null'] },
              used_at: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
        },
        quantity: { type: 'integer' },
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

export const distributeGiftCodesSchema = {
  body: {
    type: 'object',
    required: ['code_ids', 'recipient_email'],
    properties: {
      code_ids: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid',
        },
        minItems: 1,
        description: 'IDs des codes cadeaux à distribuer',
      },
      recipient_email: {
        type: 'string',
        format: 'email',
        description: 'Email du destinataire',
      },
      subject: {
        type: 'string',
        description: 'Sujet de l\'email (optionnel)',
      },
      message: {
        type: 'string',
        description: 'Message personnalisé (optionnel)',
      },
      language: {
        type: 'string',
        enum: ['fr', 'en'],
        default: 'fr',
        description: 'Langue de l\'email',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        codes_sent: { type: 'integer' },
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

export const getGiftCodesSchema = {
  querystring: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['unused', 'used', 'expired'],
        description: 'Filtrer par statut',
      },
      pack_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filtrer par pack',
      },
      recipient_email: {
        type: 'string',
        format: 'email',
        description: 'Filtrer par destinataire',
      },
      ticket_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filtrer par ticket',
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
        default: 100,
        description: 'Nombre d\'éléments par page (par défaut 100)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        codes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              code: { type: 'string' },
              status: { type: 'string', enum: ['unused', 'used', 'expired'] },
              ticket_id: { type: ['string', 'null'] },
              pack_id: { type: ['string', 'null'] },
              recipient_email: { type: ['string', 'null'] },
              expires_at: { type: ['string', 'null'] },
              used_at: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
        },
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        totalPages: { type: 'integer' },
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

export const getGiftCodePacksSchema = {
  querystring: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        pattern: '^[A-Z0-9]{12}$',
        description: 'Rechercher un code spécifique (retourne le pack qui le contient)',
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
        default: 50,
        description: 'Nombre d\'éléments par page (par défaut 50)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        packs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pack_id: { type: 'string' },
              codes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    code: { type: 'string' },
                    status: { type: 'string', enum: ['unused', 'used', 'expired'] },
                    ticket_id: { type: ['string', 'null'] },
                    pack_id: { type: ['string', 'null'] },
                    recipient_email: { type: ['string', 'null'] },
                    expires_at: { type: ['string', 'null'] },
                    used_at: { type: ['string', 'null'] },
                    notes: { type: ['string', 'null'] },
                    created_at: { type: 'string' },
                    updated_at: { type: 'string' },
                  },
                },
              },
              codes_count: { type: 'integer' },
              unused_count: { type: 'integer' },
              used_count: { type: 'integer' },
              expired_count: { type: 'integer' },
              created_at: { type: 'string' },
            },
          },
        },
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        totalPages: { type: 'integer' },
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

export const purchaseGiftCodesSchema = {
  body: {
    type: 'object',
    required: ['quantity', 'email', 'success_url', 'cancel_url'],
    properties: {
      quantity: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        description: 'Nombre de codes cadeaux à acheter',
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Email de l\'acheteur / destinataire',
      },
      language: {
        type: 'string',
        enum: ['fr', 'en'],
        default: 'fr',
        description: 'Langue de l\'email de confirmation',
      },
      success_url: {
        type: 'string',
        format: 'uri',
        description: 'URL de redirection après paiement réussi',
      },
      cancel_url: {
        type: 'string',
        format: 'uri',
        description: 'URL de redirection en cas d\'annulation',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        checkout_id: { type: 'string' },
        checkout_url: { type: 'string' },
      },
      required: ['checkout_id', 'checkout_url'],
    },
    400: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
    500: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
  },
};

export const confirmPurchaseGiftCodesSchema = {
  body: {
    type: 'object',
    required: ['checkout_id'],
    properties: {
      checkout_id: {
        type: 'string',
        description: 'ID de la session Stripe à confirmer',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        pack_id: { type: 'string' },
        codes: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['pack_id', 'codes'],
    },
    400: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
    500: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
  },
};

export const validateGiftCodeSchema = {
  params: {
    type: 'object',
    required: ['code'],
    properties: {
      code: {
        type: 'string',
        pattern: '^[A-Z0-9]{12}$',
        description: 'Code cadeau à valider (12 caractères alphanumériques majuscules)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        code: { type: 'string' },
        status: { type: 'string', enum: ['unused', 'used', 'expired'] },
        ticket_id: { type: ['string', 'null'] },
        pack_id: { type: ['string', 'null'] },
        recipient_email: { type: ['string', 'null'] },
        expires_at: { type: ['string', 'null'] },
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

