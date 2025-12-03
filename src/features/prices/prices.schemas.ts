/**
 * Schémas de validation Fastify pour les tarifs
 */

export const createPriceSchema = {
  body: {
    type: 'object',
    required: ['amount', 'audience_type', 'translations'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID optionnel pour l\'upsert : si fourni et existe, met à jour le tarif ; sinon crée un nouveau tarif avec cet ID ou génère un nouvel ID',
      },
      amount: {
        type: 'number',
        minimum: 0,
        description: 'Montant en euros',
      },
      audience_type: {
        type: 'string',
        enum: ['public', 'member', 'holiday'],
        description: 'Type d\'audience (public, member ou holiday)',
      },
      start_date: {
        type: 'string',
        format: 'date',
        description: 'Date de début de validité (format YYYY-MM-DD)',
      },
      end_date: {
        type: 'string',
        format: 'date',
        description: 'Date de fin de validité (format YYYY-MM-DD)',
      },
      is_active: {
        type: 'boolean',
        default: true,
        description: 'Indique si le tarif est actif',
      },
      requires_proof: {
        type: 'boolean',
        default: false,
        description: 'Indique si le tarif nécessite un justificatif (ex: tarif réduit étudiant, senior, etc.)',
      },
      position: {
        type: 'integer',
        minimum: 1,
        description: 'Position pour l\'ordre d\'affichage (optionnel, sera auto-assignée si non fournie)',
      },
      translations: {
        type: 'array',
        minItems: 1,
        description: 'Traductions du tarif (au moins une traduction pour "name" est requise)',
        items: {
          type: 'object',
          required: ['lang', 'field_name', 'translation'],
          properties: {
            lang: {
              type: 'string',
              minLength: 2,
              maxLength: 10,
              description: 'Code de langue (ex: "fr", "en", "es")',
            },
            field_name: {
              type: 'string',
              enum: ['name', 'description'],
              description: 'Nom du champ à traduire (name ou description)',
            },
            translation: {
              type: 'string',
              minLength: 1,
              description: 'Texte traduit',
            },
          },
        },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      description: 'Tarif mis à jour (si id fourni et existe)',
      properties: {
        id: { type: 'string' },
        amount: { type: 'number' },
        audience_type: { type: 'string' },
        start_date: { type: ['string', 'null'] },
        end_date: { type: ['string', 'null'] },
        is_active: { type: 'boolean' },
        requires_proof: { type: 'boolean' },
        position: { type: 'integer' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
        translations: {
          type: 'object',
          description: 'Traductions organisées par langue et champ',
          additionalProperties: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
        name: { type: 'string' },
        description: { type: ['string', 'null'] },
      },
    },
    201: {
      type: 'object',
      description: 'Nouveau tarif créé',
      properties: {
        id: { type: 'string' },
        amount: { type: 'number' },
        audience_type: { type: 'string' },
        start_date: { type: ['string', 'null'] },
        end_date: { type: ['string', 'null'] },
        is_active: { type: 'boolean' },
        requires_proof: { type: 'boolean' },
        position: { type: 'integer' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
        translations: {
          type: 'object',
          description: 'Traductions organisées par langue et champ',
          additionalProperties: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
        name: { type: 'string' },
        description: { type: ['string', 'null'] },
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

export const updatePriceSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID du tarif à mettre à jour',
      },
    },
  },
  body: {
    type: 'object',
    properties: {
      amount: {
        type: 'number',
        minimum: 0,
        description: 'Montant en euros',
      },
      audience_type: {
        type: 'string',
        enum: ['public', 'member', 'holiday'],
        description: 'Type d\'audience (public, member ou holiday)',
      },
      start_date: {
        type: ['string', 'null'],
        format: 'date',
        description: 'Date de début de validité (format YYYY-MM-DD)',
      },
      end_date: {
        type: ['string', 'null'],
        format: 'date',
        description: 'Date de fin de validité (format YYYY-MM-DD)',
      },
      is_active: {
        type: 'boolean',
        description: 'Indique si le tarif est actif',
      },
      requires_proof: {
        type: 'boolean',
        description: 'Indique si le tarif nécessite un justificatif',
      },
      position: {
        type: 'integer',
        minimum: 1,
        description: 'Position pour l\'ordre d\'affichage',
      },
      translations: {
        type: 'array',
        description: 'Traductions du tarif',
        items: {
          type: 'object',
          required: ['lang', 'field_name', 'translation'],
          properties: {
            lang: {
              type: 'string',
              minLength: 2,
              maxLength: 10,
              description: 'Code de langue (ex: "fr", "en", "es")',
            },
            field_name: {
              type: 'string',
              enum: ['name', 'description'],
              description: 'Nom du champ à traduire (name ou description)',
            },
            translation: {
              type: 'string',
              minLength: 1,
              description: 'Texte traduit',
            },
          },
        },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        amount: { type: 'number' },
        audience_type: { type: 'string' },
        start_date: { type: ['string', 'null'] },
        end_date: { type: ['string', 'null'] },
        is_active: { type: 'boolean' },
        requires_proof: { type: 'boolean' },
        position: { type: 'integer' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
        translations: {
          type: 'object',
          description: 'Traductions organisées par langue et champ',
          additionalProperties: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
        name: { type: 'string' },
        description: { type: ['string', 'null'] },
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

export const getPricesSchema = {
  querystring: {
    type: 'object',
    properties: {
      audience_type: {
        type: 'string',
        enum: ['public', 'member'],
        description: 'Filtrer par type d\'audience',
      },
      date: {
        type: 'string',
        format: 'date',
        description: 'Récupérer les tarifs valides pour une date spécifique (format YYYY-MM-DD)',
      },
      is_active: {
        type: 'boolean',
        description: 'Filtrer par statut actif/inactif',
      },
      lang: {
        type: 'string',
        minLength: 2,
        maxLength: 10,
        description: 'Code de langue pour les traductions (ex: "fr", "en"). Si non fourni, retourne toutes les traductions',
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
          amount: { type: 'number' },
          audience_type: { type: 'string' },
          start_date: { type: ['string', 'null'] },
          end_date: { type: ['string', 'null'] },
          is_active: { type: 'boolean' },
          requires_proof: { type: 'boolean' },
          created_at: { type: 'string' },
          updated_at: { type: 'string' },
          translations: {
            type: 'object',
            description: 'Traductions organisées par langue et champ',
            additionalProperties: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
          },
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
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

export const getPriceByIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID du tarif',
      },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      lang: {
        type: 'string',
        minLength: 2,
        maxLength: 10,
        description: 'Code de langue pour les traductions (ex: "fr", "en"). Si non fourni, retourne toutes les traductions',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        amount: { type: 'number' },
        audience_type: { type: 'string' },
        start_date: { type: ['string', 'null'] },
        end_date: { type: ['string', 'null'] },
        is_active: { type: 'boolean' },
        requires_proof: { type: 'boolean' },
        position: { type: 'integer' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
        translations: {
          type: 'object',
          description: 'Traductions organisées par langue et champ',
          additionalProperties: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
        name: { type: 'string' },
        description: { type: ['string', 'null'] },
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

export const deletePriceSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID du tarif à supprimer',
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

export const reorderPricesSchema = {
  body: {
    type: 'object',
    required: ['price_ids'],
    properties: {
      price_ids: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid',
        },
        minItems: 1,
        description: 'Tableau d\'IDs de tarifs dans l\'ordre souhaité. Les positions seront mises à jour selon cet ordre (premier ID = position 1, deuxième ID = position 2, etc.)',
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
          amount: { type: 'number' },
          audience_type: { type: 'string' },
          start_date: { type: ['string', 'null'] },
          end_date: { type: ['string', 'null'] },
          is_active: { type: 'boolean' },
          requires_proof: { type: 'boolean' },
          position: { type: 'integer' },
          created_at: { type: 'string' },
          updated_at: { type: 'string' },
          translations: {
            type: 'object',
            description: 'Traductions organisées par langue et champ',
            additionalProperties: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
          },
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
        },
      },
      description: 'Liste des tarifs réordonnés avec leurs nouvelles positions',
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

