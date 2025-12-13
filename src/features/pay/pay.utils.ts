import type { FastifyInstance } from 'fastify';
import type {
  CheckoutSessionResponse,
  CheckoutStatus,
  PaymentStats,
} from './pay.types.ts';
import Stripe from 'stripe';


/**
 * Crée une instance Stripe avec la clé secrète depuis les variables d'environnement
 */
function getStripeInstance(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY n\'est pas configurée');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });
}


/**
 * Convertit un montant en centimes (Stripe utilise les centimes)
 */
function convertToCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Calcule les statistiques de paiements (toutes les transactions réussies)
 * - total_all_time : total de tous les paiements réussis
 * - total_month : total depuis le début du mois courant
 * - total_week : total des 7 derniers jours
 * - total_day : total depuis minuit aujourd'hui
 */
export async function getPaymentStats(app: FastifyInstance): Promise<PaymentStats> {
  const stripe = getStripeInstance();

  const now = Math.floor(Date.now() / 1000);
  const nowDate = new Date();

  const dayStart = Math.floor(new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime() / 1000);

  const monthStart = Math.floor(new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    1
  ).getTime() / 1000);

  const weekStart = now - 7 * 24 * 60 * 60; // 7 derniers jours

  let totalAllTimeCents = 0;
  let totalMonthCents = 0;
  let totalWeekCents = 0;
  let totalDayCents = 0;
  let currency: string | null = null;

  try {
    // Pagination manuelle sur les PaymentIntents (les plus récents d'abord)
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const page: Stripe.ApiList<Stripe.PaymentIntent> = await stripe.paymentIntents.list({
        limit: 100,
        starting_after: startingAfter,
      });

      for (const pi of page.data) {
        if (pi.status !== 'succeeded') {
          continue;
        }

        if (!currency && pi.currency) {
          currency = pi.currency.toUpperCase();
        }

        const created = pi.created;
        const amountCents = typeof pi.amount_received === 'number'
          ? pi.amount_received
          : pi.amount;

        totalAllTimeCents += amountCents;

        if (created >= monthStart) {
          totalMonthCents += amountCents;
        }
        if (created >= weekStart) {
          totalWeekCents += amountCents;
        }
        if (created >= dayStart) {
          totalDayCents += amountCents;
        }
      }

      hasMore = page.has_more;
      if (page.data.length > 0) {
        startingAfter = page.data[page.data.length - 1].id;
      } else {
        startingAfter = undefined;
      }
    }
  } catch (err) {
    app.log.error({ err }, 'Erreur lors du calcul des statistiques Stripe');
    throw err;
  }

  const divisor = 100;

  return {
    total_all_time: totalAllTimeCents / divisor,
    total_month: totalMonthCents / divisor,
    total_week: totalWeekCents / divisor,
    total_day: totalDayCents / divisor,
    currency: (currency || 'EUR').toUpperCase(),
  };
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
  const stripe = getStripeInstance();

  // Convertir le montant en centimes
  const amountInCents = convertToCents(amount);

  // Les URLs doivent être fournies par le frontend
  if (!successUrl) {
    throw new Error('success_url est obligatoire');
  }
  if (!cancelUrl) {
    throw new Error('cancel_url est obligatoire');
  }

  try {
    // Utiliser le SDK Stripe pour créer la session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: description || 'Réservation',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(metadata && { metadata }),
    });

    app.log.info({ sessionId: session.id, amount, currency }, 'Session Stripe créée');

    // Convertir en format CheckoutSessionResponse
    return {
      id: session.id,
      url: session.url || '',
      amount_total: session.amount_total || amountInCents,
      currency: session.currency || currency.toLowerCase(),
      status: session.status || 'open',
      payment_status: session.payment_status || 'unpaid',
      ...(session.payment_intent && { payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id }),
    } as CheckoutSessionResponse;
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
  const stripe = getStripeInstance();

  try {
    // Utiliser le SDK Stripe pour récupérer la session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Convertir en format CheckoutStatus
    return {
      id: session.id,
      amount_total: session.amount_total || 0,
      currency: session.currency || 'eur',
      status: session.status || 'open',
      payment_status: session.payment_status || 'unpaid',
      ...(session.payment_intent && {
        payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id
      }),
    } as CheckoutStatus;
  } catch (err) {
    app.log.error({ err, sessionId }, 'Erreur lors de la vérification du statut Stripe');
    throw err;
  }
}

/**
 * Vérifie la signature d'un webhook Stripe et construit l'objet Event
 * 
 * Utilise la méthode officielle Stripe: stripe.webhooks.constructEvent()
 * qui gère automatiquement:
 * - La vérification de signature (v1 et v0)
 * - La vérification du timestamp (protection contre replay attacks)
 * - La construction de l'objet Event typé
 * 
 * @param payload - Le body brut de la requête (string ou Buffer)
 * @param signature - Le header Stripe-Signature
 * @returns L'objet Event Stripe si la signature est valide
 * @throws Stripe.errors.StripeSignatureVerificationError si la signature est invalide
 * 
 * @see https://docs.stripe.com/webhooks
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET n\'est pas configurée');
  }

  if (!signature) {
    throw new Error('Signature est requise');
  }

  // Utiliser le SDK Stripe pour construire et vérifier l'event
  // Cette méthode gère automatiquement la vérification de signature et du timestamp
  const stripe = getStripeInstance();

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    webhookSecret
  );
}

