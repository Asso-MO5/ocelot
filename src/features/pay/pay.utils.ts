import type { FastifyInstance } from 'fastify';
import type {
  CheckoutSessionResponse,
  CheckoutStatus,
  PaymentStats,
} from './pay.types.ts';
import Stripe from 'stripe';


function getStripeInstance(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY n\'est pas configurée');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });
}


function convertToCents(amount: number): number {
  return Math.round(amount * 100);
}

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
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const page: Stripe.ApiList<Stripe.PaymentIntent> = await stripe.paymentIntents.list({
        limit: 30000,
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

  const amountInCents = convertToCents(amount);

  if (!successUrl) {
    throw new Error('success_url est obligatoire');
  }
  if (!cancelUrl) {
    throw new Error('cancel_url est obligatoire');
  }

  try {
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

export async function getCheckoutStatus(
  app: FastifyInstance,
  sessionId: string
): Promise<CheckoutStatus> {
  const stripe = getStripeInstance();

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return {
      id: session.id,
      amount_total: session.amount_total || 0,
      currency: session.currency || 'eur',
      status: session.status || 'open',
      payment_status: session.payment_status || 'unpaid',
      ...(session.metadata && { metadata: session.metadata as Record<string, string> }),
      ...(session.payment_intent && {
        payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id
      }),
    } as CheckoutStatus;
  } catch (err) {
    app.log.error({ err, sessionId }, 'Erreur lors de la vérification du statut Stripe');
    throw err;
  }
}

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

  const stripe = getStripeInstance();

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    webhookSecret
  );
}

