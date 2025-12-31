import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getCheckoutStatus, constructWebhookEvent, getPaymentStats } from './pay.utils.ts';
import { webhookSchema, getCheckoutStatusSchema, getPaymentStatsSchema } from './pay.schemas.ts';
import type { WebhookBody } from './pay.types.ts';
import { updateTicketsByCheckoutStatus } from '../tickets/tickets.service.ts';
import Stripe from 'stripe';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';


export async function getCheckoutStatusHandler(
  req: FastifyRequest<{ Params: { sessionId: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return reply.code(400).send({ error: 'sessionId est requis' });
    }

    const sessionStatus = await getCheckoutStatus(app, sessionId);

    return reply.send({
      id: sessionStatus.id,
      checkout_reference: sessionStatus.id,
      amount: sessionStatus.amount_total / 100,
      currency: sessionStatus.currency.toUpperCase(),
      status: sessionStatus.payment_status === 'paid' ? 'PAID' :
        sessionStatus.status === 'expired' ? 'CANCELLED' :
          sessionStatus.payment_status === 'unpaid' ? 'PENDING' : 'PENDING',
      transaction_code: sessionStatus.payment_intent || undefined,
    });
  } catch (err: any) {
    app.log.error({ err, sessionId: req.params.sessionId }, 'Erreur lors de la vérification du statut');

    if (err.message?.includes('404') || err.message?.includes('not found')) {
      return reply.code(404).send({ error: 'Session non trouvée' });
    }

    return reply.code(500).send({ error: 'Erreur lors de la vérification du statut' });
  }
}

export async function webhookHandlerWithRawBody(
  req: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance,
  rawBody: Buffer,
  body: WebhookBody
) {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      app.log.warn({}, 'Signature Stripe manquante');
      return reply.code(400).send({ error: 'Signature manquante' });
    }

    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(rawBody, signature);
      app.log.info({ eventType: event.type, eventId: event.id }, 'Webhook signature validée');
    } catch (err: any) {
      const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

      if (isDevelopment) {
        app.log.warn({
          error: err.message
        }, 'Signature webhook invalide, mais on continue en développement');

        try {
          event = body as any as Stripe.Event;
        } catch (parseErr) {
          app.log.error({ parseErr }, 'Erreur lors du parsing de l\'event depuis body');
          return reply.code(400).send({ error: `Signature invalide et body non parsable: ${err.message}` });
        }
      } else {
        app.log.warn({
          error: err.message
        }, 'Signature webhook invalide');
        return reply.code(400).send({ error: `Signature invalide: ${err.message}` });
      }
    }

    const eventType = event.type;

    let sessionId: string | undefined;
    let checkoutStatus: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'SENT' | 'SUCCESS' | null = null;
    let paymentIntentId: string | undefined;

    if (eventType === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      sessionId = session.id;
      checkoutStatus = session.payment_status === 'paid' ? 'PAID' : 'PENDING';
      if (session.status === 'expired') {
        checkoutStatus = 'CANCELLED';
      }
      paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

      if (session.customer_details) {
        const customerDetails = session.customer_details;
        const customerEmail = customerDetails.email;
        const customerName = customerDetails.name;

        let firstName: string | undefined;
        let lastName: string | undefined;
        if (customerName) {
          const nameParts = customerName.trim().split(/\s+/);
          if (nameParts.length > 0) {
            firstName = nameParts[0];
            if (nameParts.length > 1) {
              lastName = nameParts.slice(1).join(' ');
            }
          }
        }

        if (customerEmail || firstName || lastName) {
          try {
            const { updateTicketsCustomerInfo } = await import('../tickets/tickets.service.ts');
            await updateTicketsCustomerInfo(app, sessionId, {
              first_name: firstName || undefined,
              last_name: lastName || undefined,
            });
          } catch (err) {
            app.log.warn({ err, sessionId }, 'Erreur lors de la mise à jour des informations client');
          }
        }
      }
    } else if (eventType === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      sessionId = paymentIntent.id;
      paymentIntentId = paymentIntent.id;
      checkoutStatus = 'PAID';
    } else if (eventType === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      sessionId = paymentIntent.id;
      paymentIntentId = paymentIntent.id;
      checkoutStatus = 'FAILED';
    } else if (eventType === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      sessionId = session.id;
      paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
      checkoutStatus = 'PAID';
    } else if (eventType === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      sessionId = session.id;
      paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
      checkoutStatus = 'FAILED';
    } else if (eventType === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      sessionId = session.id;
      checkoutStatus = 'CANCELLED';
    } else if (eventType === 'charge.succeeded' || eventType === 'charge.updated') {
      const charge = event.data.object as Stripe.Charge;
      if (charge.payment_intent) {
        paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent.id;
        return reply.send({
          success: true,
          tickets_updated: 0,
          qr_codes: []
        });
      }
    }

    if (!sessionId) {
      return reply.send({
        success: true,
        tickets_updated: 0,
        qr_codes: []
      });
    }

    let ticketsUpdated = 0;
    if (checkoutStatus && (checkoutStatus === 'PAID' || checkoutStatus === 'FAILED' || checkoutStatus === 'CANCELLED')) {
      ticketsUpdated = await updateTicketsByCheckoutStatus(
        app,
        sessionId,
        checkoutStatus,
        paymentIntentId || checkoutStatus
      );

      if (checkoutStatus === 'PAID' && ticketsUpdated > 0) {
        try {
          (app.ws as any)?.send('tickets_stats', 'refetch');
        } catch (wsError) {
          app.log.warn({ wsError }, 'Erreur lors de l\'envoi du message WebSocket');
        }

        try {
          const { getTicketsByCheckoutId } = await import('../tickets/tickets.service.ts');
          const { sendTicketsConfirmationEmails } = await import('../tickets/tickets.email.ts');
          const tickets = await getTicketsByCheckoutId(app, sessionId);

          if (tickets.length > 0) {
            await sendTicketsConfirmationEmails(app, tickets);

            try {
              const { generateDonationProofFromTicket } = await import('../donation-proof/donation-proof.service.ts');
              const { emailUtils } = await import('../email/email.utils.ts');

              for (const ticket of tickets) {
                const donationAmount = typeof ticket.donation_amount === 'string'
                  ? parseFloat(ticket.donation_amount)
                  : ticket.donation_amount;

                if (donationAmount && donationAmount > 0) {
                  try {
                    const pdfBuffer = await generateDonationProofFromTicket(ticket);
                    if (pdfBuffer) {
                      const pdfBase64 = pdfBuffer.toString('base64');
                      const fileName = `certificat-don-${ticket.id.substring(0, 8)}.pdf`;

                      const visitorName = ticket.first_name && ticket.last_name
                        ? `${ticket.first_name} ${ticket.last_name}`
                        : ticket.email;

                      await emailUtils.sendEmail({
                        email: ticket.email,
                        name: visitorName,
                        subject: 'Certificat de don - Association MO5.com',
                        body: `<p>Bonjour,</p><p>Merci pour votre don de ${donationAmount.toFixed(2)}€.</p><p>Veuillez trouver ci-joint votre certificat de don CERFA 11580.</p><p>Cordialement,<br>L'équipe MO5.com</p>`,
                        language: (ticket.language?.split('-')[0]?.toLowerCase() === 'en' ? 'en' : 'fr') as 'fr' | 'en',
                        attachments: [{
                          name: fileName,
                          content: pdfBase64,
                          contentType: 'application/pdf'
                        }]
                      });
                      app.log.info({ ticketId: ticket.id, email: ticket.email }, 'Certificat de don généré et envoyé par email');
                    }
                  } catch (donationError: any) {
                    app.log.error({
                      donationError,
                      errorMessage: donationError?.message,
                      errorStack: donationError?.stack,
                      ticketId: ticket.id,
                      donationAmount
                    }, 'Erreur lors de la génération/envoi du certificat de don');
                  }
                }
              }
            } catch (donationProofError) {
              app.log.error({ donationProofError, sessionId }, 'Erreur lors de la génération des certificats de don');
            }
          }
        } catch (emailError) {
          app.log.error({ emailError, sessionId }, 'Erreur lors de l\'envoi des emails de confirmation');
        }
      }
    }

    let qrCodes: string[] = [];
    try {
      const { getTicketsByCheckoutId } = await import('../tickets/tickets.service.ts');
      const tickets = await getTicketsByCheckoutId(app, sessionId);
      qrCodes = tickets.map(ticket => ticket.qr_code);
    } catch (error) {
      app.log.warn({ error, sessionId }, 'Erreur lors de la récupération des QR codes des tickets');
    }


    return reply.send({
      success: true,
      tickets_updated: ticketsUpdated,
      qr_codes: qrCodes,
    });
  } catch (err: any) {
    app.log.error({
      err,
      errorMessage: err?.message,
      errorStack: err?.stack,
      body
    }, 'Erreur lors du traitement du webhook');
    return reply.code(500).send({ error: 'Erreur lors du traitement du webhook' });
  }
}

export function registerPayRoutes(app: FastifyInstance) {
  app.get(
    '/pay/stats',
    {
      schema: getPaymentStatsSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (_req, reply) => {
      try {
        const stats = await getPaymentStats(app);
        return reply.send(stats);
      } catch (err: any) {
        app.log.error({ err }, 'Erreur lors de la récupération des statistiques de paiements');
        return reply.code(500).send({ error: 'Erreur lors de la récupération des statistiques de paiements' });
      }
    }
  );

  app.get<{ Params: { sessionId: string } }>(
    '/pay/checkout/:sessionId',
    {
      schema: getCheckoutStatusSchema,
    },
    async (req, reply) => getCheckoutStatusHandler(req, reply, app)
  );

  app.post<{ Body: WebhookBody }>(
    '/pay/webhook',
    {
      schema: webhookSchema,
    },
    async (req, reply) => {
      const rawBody = (req as any).rawBody as Buffer;
      const body = req.body as WebhookBody;

      if (!rawBody) {
        app.log.error({}, 'Raw body non disponible dans le handler');
        return reply.code(500).send({ error: 'Raw body non disponible' });
      }

      if (!Buffer.isBuffer(rawBody)) {
        app.log.error({}, 'Raw body n\'est pas un Buffer');
        return reply.code(500).send({ error: 'Raw body invalide' });
      }

      if (!body) {
        app.log.error({}, 'Body non disponible dans le handler');
        return reply.code(500).send({ error: 'Body non disponible' });
      }

      return webhookHandlerWithRawBody(req, reply, app, rawBody, body);
    }
  );
}