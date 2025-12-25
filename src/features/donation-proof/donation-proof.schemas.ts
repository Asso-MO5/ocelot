export const generateDonationProofSchema = {
  querystring: {
    type: 'object',
    required: ['ticket_id'],
    properties: {
      ticket_id: {
        type: 'string',
        description: 'ID du ticket pour lequel générer le certificat de don',
      },
      address: {
        type: 'string',
        description: 'Adresse du donateur (optionnel)',
      },
      postal_code: {
        type: 'string',
        description: 'Code postal du donateur (optionnel)',
      },
      city: {
        type: 'string',
        description: 'Ville du donateur (optionnel)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      description: 'PDF du certificat de don',
      content: {
        'application/pdf': {
          schema: {
            type: 'string',
            format: 'binary',
          },
        },
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

