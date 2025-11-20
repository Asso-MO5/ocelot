import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createSumUpCheckout, getSumUpCheckoutStatus } from './pay.utils.ts';
import { createCheckoutSchema, getCheckoutStatusSchema, sumUpWebhookSchema } from './pay.schemas.ts';
import type { CreateCheckoutBody, SumUpWebhookBody } from './pay.types.ts';
import { updateTicketsByCheckoutStatus } from '../tickets/tickets.service.ts';

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
 * Handler pour recevoir les webhooks SumUp
 */
export async function sumUpWebhookHandler(
  req: FastifyRequest<{ Body: SumUpWebhookBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const body = req.body;

    // Extraire les informations du webhook (peut être dans event ou directement dans body)
    const event = body.event || body;
    const checkoutId = event.checkout_id || body.checkout_id;
    const status = (event.status || body.status) as 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'SENT' | 'SUCCESS' | undefined;
    const transactionCode = event.transaction_code || body.transaction_code;

    if (!checkoutId) {
      app.log.warn({ body }, 'Webhook SumUp reçu sans checkout_id');
      return reply.code(400).send({ error: 'checkout_id est requis' });
    }

    if (!status) {
      app.log.warn({ body, checkoutId }, 'Webhook SumUp reçu sans statut');
      return reply.code(400).send({ error: 'status est requis' });
    }

    // Mettre à jour les tickets associés uniquement pour les statuts finaux
    // SENT est un statut intermédiaire, on ne fait rien
    let ticketsUpdated = 0;
    if (status && status !== 'SENT' && status !== 'PENDING') {
      // SUCCESS est équivalent à PAID
      const finalStatus = status === 'SUCCESS' ? 'PAID' : status;
      // On passe transactionCode si disponible, sinon le statut SumUp
      // Le statut du paiement est déjà dans la colonne 'status' (paid/cancelled)
      ticketsUpdated = await updateTicketsByCheckoutStatus(
        app,
        checkoutId,
        finalStatus,
        transactionCode || finalStatus
      );

      // Envoyer un message WebSocket à la room tickets_stats si le paiement est confirmé
      if ((status === 'PAID' || status === 'SUCCESS') && ticketsUpdated > 0) {
        try {
          (app.ws as any)?.send('tickets_stats', 'refetch');
        } catch (wsError) {
          app.log.warn({ wsError }, 'Erreur lors de l\'envoi du message WebSocket');
        }
      }
    } else if (status === 'SENT') {
      // Pour SENT, on peut juste logger mais ne pas mettre à jour les tickets
      app.log.info({ checkoutId, status }, 'Webhook SumUp reçu avec statut SENT (intermédiaire)');
    }

    app.log.info(
      { checkoutId, status, ticketsUpdated, transactionCode },
      'Webhook SumUp traité avec succès'
    );

    return reply.send({
      success: true,
      tickets_updated: ticketsUpdated,
    });
  } catch (err: any) {
    app.log.error({
      err,
      errorMessage: err?.message,
      errorStack: err?.stack,
      body: req.body
    }, 'Erreur lors du traitement du webhook SumUp');
    return reply.code(500).send({ error: 'Erreur lors du traitement du webhook' });
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

  // Route publique pour recevoir les webhooks SumUp
  app.post<{ Body: SumUpWebhookBody }>(
    '/pay/webhook',
    {
      schema: sumUpWebhookSchema,
    },
    async (req, reply) => sumUpWebhookHandler(req, reply, app)
  );
}