export const webhookSchema = {
  body: {
    type: 'object',
    required: ['id', 'type', 'data'],
    properties: {
      id: {
        type: 'string',
        description: 'ID de l\'événement webhook',
      },
      type: {
        type: 'string',
        description: 'Type d\'événement (checkout.session.completed, payment_intent.succeeded, etc.)',
      },
      created: {
        type: 'number',
        description: 'Timestamp Unix de l\'événement',
      },
      data: {
        type: 'object',
        required: ['object'],
        properties: {
          object: {
            type: 'object',
            description: 'Objet de l\'événement (checkout.session ou payment_intent)',
            properties: {
              id: { type: 'string' },
              object: { type: 'string' },
              amount_total: { type: 'number' },
              currency: { type: 'string' },
              status: { type: 'string' },
              payment_status: { type: 'string' },
              payment_intent: { type: 'string' },
              metadata: { type: 'object' },
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
        success: {
          type: 'boolean',
          description: 'Indique si le webhook a été traité avec succès',
        },
        tickets_updated: {
          type: 'number',
          description: 'Nombre de tickets mis à jour',
        },
        qr_codes: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Liste des QR codes des tickets associés au checkout',
        },
      },
      required: ['success', 'tickets_updated', 'qr_codes'],
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

export const getCheckoutStatusSchema = {
  params: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: {
        type: 'string',
        description: 'ID de la session de checkout',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        amount_total: {
          type: 'number',
        },
        currency: {
          type: 'string',
        },
        status: {
          type: 'string',
          enum: ['open', 'complete', 'expired'],
        },
        payment_status: {
          type: 'string',
          enum: ['paid', 'unpaid', 'no_payment_required'],
        },
        payment_intent: {
          type: 'string',
        },
      },
    },
    404: {
      type: 'object',
      properties: {
        error: {
          type: 'string',
        },
      },
    },
    500: {
      type: 'object',
      properties: {
        error: {
          type: 'string',
        },
      },
    },
  },
};


