import type { FastifyInstance } from 'fastify';
import type {
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  CheckoutStatus,
} from './pay.types.ts';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

/**
 * Récupère la clé secrète Stripe depuis les variables d'environnement
 */
function getStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY n\'est pas configurée');
  }
  return secretKey;
}

/**
 * Convertit un montant en centimes (Stripe utilise les centimes)
 */
function convertToCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Crée une session de checkout
 */
export async function createCheckout(
  app: FastifyInstance,
  amount: number,
  description?: string,
  currency: string = 'EUR',
  successUrl?: string,
  cancelUrl?: string,
  metadata?: Record<string, string>
): Promise<CheckoutSessionResponse> {
  const secretKey = getStripeSecretKey();

  // Convertir le montant en centimes
  const amountInCents = convertToCents(amount);

  // Les URLs doivent être fournies par le frontend
  if (!successUrl) {
    throw new Error('success_url est obligatoire');
  }
  if (!cancelUrl) {
    throw new Error('cancel_url est obligatoire');
  }

  // Note: sessionData n'est utilisé que pour la structure, les données réelles sont dans formData
  const sessionData = {
    amount: amountInCents,
    currency: currency.toLowerCase(),
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(description && { payment_intent_data: { description } }),
    ...(metadata && { metadata }),
  };

  try {
    // Utiliser l'API REST de Stripe avec form-data
    const formData = new URLSearchParams();
    formData.append('line_items[0][price_data][currency]', currency.toLowerCase());
    formData.append('line_items[0][price_data][product_data][name]', description || 'Réservation');
    formData.append('line_items[0][price_data][unit_amount]', amountInCents.toString());
    formData.append('line_items[0][quantity]', '1');
    formData.append('mode', 'payment');
    formData.append('success_url', sessionData.success_url);
    formData.append('cancel_url', sessionData.cancel_url);
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        formData.append(`metadata[${key}]`, value);
      });
    }

    const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      app.log.error({ status: response.status, error: errorText }, 'Erreur lors de la création de la session Stripe');
      throw new Error(`Erreur Stripe: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as CheckoutSessionResponse;
    app.log.info({ sessionId: data.id, amount, currency }, 'Session Stripe créée');
    return data;
  } catch (err) {
    app.log.error({ err, amount, currency }, 'Erreur lors de la création de la session Stripe');
    throw err;
  }
}

/**
 * Vérifie le statut d'une session de checkout
 */
export async function getCheckoutStatus(
  app: FastifyInstance,
  sessionId: string
): Promise<CheckoutStatus> {
  const secretKey = getStripeSecretKey();

  try {
    const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      app.log.error({ status: response.status, error: errorText, sessionId }, 'Erreur lors de la vérification du statut Stripe');
      throw new Error(`Erreur Stripe: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as CheckoutStatus;
    return data;
  } catch (err) {
    app.log.error({ err, sessionId }, 'Erreur lors de la vérification du statut Stripe');
    throw err;
  }
}

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Vérifie la signature d'un webhook Stripe
 * Format Stripe: signature = "t=timestamp,v1=signature"
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || secret;
  if (!webhookSecret) {
    return false;
  }

  if (!signature) {
    return false;
  }

  try {
    // Stripe envoie la signature au format: "t=timestamp,v1=signature"
    const elements = signature.split(',');
    const timestampElement = elements.find(el => el.startsWith('t='));
    const signatureElement = elements.find(el => el.startsWith('v1='));

    if (!timestampElement || !signatureElement) {
      return false;
    }

    const timestamp = timestampElement.split('=')[1];
    const receivedSignature = signatureElement.split('=')[1];

    // Convertir le payload en string si c'est un Buffer
    const payloadString = typeof payload === 'string' ? payload : payload.toString('utf-8');

    // Construire le message signé: timestamp + '.' + payload
    const signedPayload = `${timestamp}.${payloadString}`;

    // Calculer le HMAC SHA256
    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf-8')
      .digest('hex');

    // Comparaison sécurisée pour éviter les attaques par timing
    if (expectedSignature.length !== receivedSignature.length) {
      return false;
    }

    return timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    // En cas d'erreur, ne pas accepter la signature
    return false;
  }
}

