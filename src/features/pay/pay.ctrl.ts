import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getCheckoutStatus, constructWebhookEvent, getPaymentStats } from './pay.utils.ts';
import { webhookSchema, getCheckoutStatusSchema, getPaymentStatsSchema } from './pay.schemas.ts';
import type { WebhookBody } from './pay.types.ts';
import { updateTicketsByCheckoutStatus } from '../tickets/tickets.service.ts';
import Stripe from 'stripe';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';

/**
 * Handler pour vérifier le statut d'une session de checkout
 */
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

    // Convertir le format Stripe en format standard
    return reply.send({
      id: sessionStatus.id,
      checkout_reference: sessionStatus.id, // Utiliser l'ID comme référence
      amount: sessionStatus.amount_total / 100, // Convertir de centimes en euros
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

/**
 * Handler pour recevoir les webhooks avec body brut
 */
async function webhookHandlerWithRawBody(
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

    // Vérifier la signature et construire l'event avec le SDK Stripe
    // Passer directement le Buffer brut (exactement tel qu'il a été reçu)
    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(rawBody, signature);
      app.log.info({ eventType: event.type, eventId: event.id }, 'Webhook signature validée');
    } catch (err: any) {
      // En développement, permettre de continuer même si la signature échoue
      // (utile pour tester avec Stripe CLI qui peut avoir un secret différent)
      const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

      if (isDevelopment) {
        app.log.warn({
          error: err.message
        }, 'Signature webhook invalide, mais on continue en développement');

        // Parser l'event manuellement depuis le body
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

    // Extraire le session_id selon le type d'événement
    let sessionId: string | undefined;
    let checkoutStatus: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'SENT' | 'SUCCESS' | null = null;
    let paymentIntentId: string | undefined;

    if (eventType === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      sessionId = session.id;
      checkoutStatus = session.payment_status === 'paid' ? 'PAID' : 'PENDING';
      // Si la session est expirée, considérer comme annulée
      if (session.status === 'expired') {
        checkoutStatus = 'CANCELLED';
      }
      paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

      // Récupérer les informations client depuis Stripe si disponibles
      // customer_details contient name, email, phone
      if (session.customer_details) {
        const customerDetails = session.customer_details;
        const customerEmail = customerDetails.email;
        const customerName = customerDetails.name;

        // Si on a un nom complet, essayer de le séparer en prénom/nom
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

        // Mettre à jour les tickets avec les informations client si disponibles
        if (customerEmail || firstName || lastName) {
          try {
            const { updateTicketsCustomerInfo } = await import('../tickets/tickets.service.ts');
            await updateTicketsCustomerInfo(app, sessionId, {
              email: customerEmail || undefined,
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
      // Pour payment_intent, on doit récupérer la session associée depuis les metadata
      // Pour l'instant, on utilise le payment_intent_id comme checkout_id
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
      // Pour les événements charge, on peut récupérer le payment_intent
      // mais on ne peut pas directement récupérer le session_id
      // Ces événements sont généralement suivis par checkout.session.completed
      const charge = event.data.object as Stripe.Charge;
      if (charge.payment_intent) {
        paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent.id;
        // On ne peut pas récupérer le session_id directement depuis un charge
        // On ignore ces événements car checkout.session.completed sera envoyé après
        return reply.send({
          success: true,
          tickets_updated: 0,
          qr_codes: []
        });
      }
    }

    if (!sessionId) {
      // Pour les événements non gérés, on retourne 200 pour éviter les retries
      // Le schéma requiert success, tickets_updated et qr_codes
      return reply.send({
        success: true,
        tickets_updated: 0,
        qr_codes: []
      });
    }

    // Mettre à jour les tickets associés uniquement pour les statuts finaux
    let ticketsUpdated = 0;
    if (checkoutStatus && (checkoutStatus === 'PAID' || checkoutStatus === 'FAILED' || checkoutStatus === 'CANCELLED')) {
      ticketsUpdated = await updateTicketsByCheckoutStatus(
        app,
        sessionId,
        checkoutStatus,
        paymentIntentId || checkoutStatus
      );

      // Envoyer un message WebSocket à la room tickets_stats si le paiement est confirmé
      if (checkoutStatus === 'PAID' && ticketsUpdated > 0) {
        try {
          (app.ws as any)?.send('tickets_stats', 'refetch');
        } catch (wsError) {
          app.log.warn({ wsError }, 'Erreur lors de l\'envoi du message WebSocket');
        }

        // Envoyer les emails de confirmation pour les tickets payés
        try {
          const { getTicketsByCheckoutId } = await import('../tickets/tickets.service.ts');
          const { sendTicketsConfirmationEmails } = await import('../tickets/tickets.email.ts');
          const tickets = await getTicketsByCheckoutId(app, sessionId);
          if (tickets.length > 0) {
            await sendTicketsConfirmationEmails(app, tickets);

            // Générer automatiquement les certificats de don pour les tickets avec don
            try {
              const { generateDonationProofFromTicket } = await import('../donation-proof/donation-proof.service.ts');
              const { emailUtils } = await import('../email/email.utils.ts');

              for (const ticket of tickets) {
                const donationAmount = typeof ticket.donation_amount === 'string'
                  ? parseFloat(ticket.donation_amount)
                  : ticket.donation_amount;

                if (donationAmount && donationAmount > 0) {
                  try {
                    // Générer le PDF du certificat de don
                    const pdfBuffer = await generateDonationProofFromTicket(ticket);
                    if (pdfBuffer) {
                      // Convertir le buffer en base64
                      const pdfBase64 = pdfBuffer.toString('base64');
                      const fileName = `certificat-don-${ticket.id.substring(0, 8)}.pdf`;

                      // Préparer le nom du visiteur
                      const visitorName = ticket.first_name && ticket.last_name
                        ? `${ticket.first_name} ${ticket.last_name}`
                        : ticket.email;

                      // Envoyer le certificat par email
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
                    // Ne pas faire échouer le processus si la génération du certificat échoue
                  }
                }
              }
            } catch (donationProofError) {
              app.log.error({ donationProofError, sessionId }, 'Erreur lors de la génération des certificats de don');
              // Ne pas faire échouer le processus si la génération des certificats échoue
            }
          }
        } catch (emailError) {
          app.log.error({ emailError, sessionId }, 'Erreur lors de l\'envoi des emails de confirmation');
        }
      }
    }

    // Récupérer les QR codes des tickets associés au checkout
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

/**
 * Enregistre les routes de paiement
 */
export function registerPayRoutes(app: FastifyInstance) {
  // Route pour récupérer les statistiques de paiements Stripe
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

  // Route pour vérifier le statut d'une session de checkout
  app.get<{ Params: { sessionId: string } }>(
    '/pay/checkout/:sessionId',
    {
      schema: getCheckoutStatusSchema,
    },
    async (req, reply) => getCheckoutStatusHandler(req, reply, app)
  );

  // Note: Le parser pour application/json est géré dans server.ts
  // Il préserve déjà le Buffer pour la route /pay/webhook

  // Route publique pour recevoir les webhooks
  // Les parsers dans server.ts stockent déjà le Buffer brut dans req.rawBody
  // On utilise directement ce Buffer pour la vérification de signature
  app.post<{ Body: WebhookBody }>(
    '/pay/webhook',
    {
      schema: webhookSchema,
    },
    async (req, reply) => {
      // Le Buffer brut est déjà stocké par les parsers dans server.ts
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