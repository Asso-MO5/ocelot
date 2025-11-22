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

export const sumUpWebhookSchema = {
  body: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'ID de l\'événement webhook',
      },
      type: {
        type: 'string',
        description: 'Type d\'événement (checkout.payment.succeeded, checkout.payment.failed, etc.)',
      },
      timestamp: {
        type: 'string',
        description: 'Timestamp de l\'événement',
      },
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
        enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'SENT', 'SUCCESS'],
        description: 'Statut du checkout',
      },
      payment_type: {
        type: 'string',
        description: 'Type de paiement',
      },
      transaction_code: {
        type: 'string',
        description: 'Code de transaction',
      },
      merchant_code: {
        type: 'string',
        description: 'Code marchand',
      },
      event: {
        type: 'object',
        description: 'Détails de l\'événement',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          timestamp: { type: 'string' },
          checkout_id: { type: 'string' },
          checkout_reference: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          status: { type: 'string' },
          payment_type: { type: 'string' },
          transaction_code: { type: 'string' },
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
          enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'SENT', 'SUCCESS'],
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

