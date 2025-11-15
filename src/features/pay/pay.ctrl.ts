import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createSumUpCheckout, getSumUpCheckoutStatus } from './pay.utils.ts';
import { createCheckoutSchema, getCheckoutStatusSchema } from './pay.schemas.ts';
import type { CreateCheckoutBody } from './pay.types.ts';

/**
 * Handler pour créer un checkout SumUp
 */
export async function createCheckoutHandler(
  req: FastifyRequest<{ Body: CreateCheckoutBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { amount, currency = 'EUR' } = req.body;

    if (!amount || amount <= 0) {
      return reply.code(400).send({ error: 'Le montant doit être supérieur à 0' });
    }


    const checkout = await createSumUpCheckout(
      app,
      amount,
      currency
    );

    return reply.send({
      checkout_id: checkout.id,
      checkout_reference: checkout.checkout_reference,
      amount: checkout.amount,
      currency: checkout.currency,
      status: checkout.status,
    });
  } catch (err: any) {
    app.log.error({ err }, 'Erreur lors de la création du checkout');

    if (err.message?.includes('SUMUP_API_KEY') || err.message?.includes('SUMUP_MERCHANT_CODE')) {
      return reply.code(500).send({ error: 'Configuration SumUp manquante' });
    }

    return reply.code(500).send({ error: 'Erreur lors de la création du checkout' });
  }
}

/**
 * Handler pour vérifier le statut d'un checkout SumUp
 */
export async function getCheckoutStatusHandler(
  req: FastifyRequest<{ Params: { checkoutId: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { checkoutId } = req.params;

    if (!checkoutId) {
      return reply.code(400).send({ error: 'checkoutId est requis' });
    }

    const checkoutStatus = await getSumUpCheckoutStatus(app, checkoutId);

    return reply.send(checkoutStatus);
  } catch (err: any) {
    app.log.error({ err, checkoutId: req.params.checkoutId }, 'Erreur lors de la vérification du statut');

    if (err.message?.includes('404') || err.message?.includes('not found')) {
      return reply.code(404).send({ error: 'Checkout non trouvé' });
    }

    return reply.code(500).send({ error: 'Erreur lors de la vérification du statut' });
  }
}

/**
 * Enregistre les routes de paiement
 */
export function registerPayRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateCheckoutBody }>(
    '/pay/checkout',
    {
      schema: createCheckoutSchema,
    },
    async (req, reply) => createCheckoutHandler(req, reply, app)
  );

  app.get<{ Params: { checkoutId: string } }>(
    '/pay/checkout/:checkoutId',
    {
      schema: getCheckoutStatusSchema,
    },
    async (req, reply) => getCheckoutStatusHandler(req, reply, app)
  );
}