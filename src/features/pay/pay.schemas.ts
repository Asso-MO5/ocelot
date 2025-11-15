export const createCheckoutSchema = {
  body: {
    type: 'object',
    required: ['amount'],
    properties: {
      amount: {
        type: 'number',
        minimum: 5,
        maximum: 12,
        description: 'Montant du paiement',
      },
      currency: {
        type: 'string',
        default: 'EUR',
        description: 'Devise du paiement (défaut: EUR)',
      },
      description: {
        type: 'string',
        description: 'Description du paiement',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        checkout_id: {
          type: 'string',
          description: 'ID du checkout SumUp',
        },
        checkout_reference: {
          type: 'string',
          description: 'Référence du checkout',
        },
        amount: {
          type: 'number',
          description: 'Montant du paiement',
        },
        currency: {
          type: 'string',
          description: 'Devise',
        },
        status: {
          type: 'string',
          description: 'Statut du checkout',
        },
      },
    },
    400: {
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

export const getCheckoutStatusSchema = {
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
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        checkout_reference: {
          type: 'string',
        },
        amount: {
          type: 'number',
        },
        currency: {
          type: 'string',
        },
        status: {
          type: 'string',
          enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'],
        },
        payment_type: {
          type: 'string',
        },
        transaction_code: {
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

