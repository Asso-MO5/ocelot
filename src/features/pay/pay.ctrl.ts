import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createCheckout, getCheckoutStatus, verifyWebhookSignature } from './pay.utils.ts';
import { webhookSchema, getCheckoutStatusSchema } from './pay.schemas.ts';
import type { WebhookBody } from './pay.types.ts';
import { updateTicketsByCheckoutStatus } from '../tickets/tickets.service.ts';

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
 * Handler pour recevoir les webhooks
 */
export async function webhookHandler(
  req: FastifyRequest<{ Body: WebhookBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const body = req.body;
    const signature = req.headers['stripe-signature'] as string;

    // Vérifier la signature du webhook (sécurité)
    // Le raw body est stocké par le contentTypeParser global dans req.rawBody
    if (signature) {
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        app.log.warn({}, 'Raw body non disponible pour la vérification de signature');
        return reply.code(400).send({ error: 'Raw body non disponible' });
      }
      const isValid = verifyWebhookSignature(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET || '');
      if (!isValid) {
        app.log.warn({ signature }, 'Signature webhook invalide');
        return reply.code(400).send({ error: 'Signature invalide' });
      }
    }

    const eventType = body.type;
    const eventData = body.data.object;

    // Extraire le session_id selon le type d'événement
    let sessionId: string | undefined;
    let checkoutStatus: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'SENT' | 'SUCCESS' | null = null;

    if (eventType === 'checkout.session.completed') {
      sessionId = eventData.id;
      checkoutStatus = eventData.payment_status === 'paid' ? 'PAID' : 'PENDING';
      // Si la session est expirée, considérer comme annulée
      if (eventData.status === 'expired') {
        checkoutStatus = 'CANCELLED';
      }
    } else if (eventType === 'payment_intent.succeeded') {
      // Pour payment_intent, on doit récupérer la session associée
      // Pour l'instant, on utilise le payment_intent_id comme checkout_id
      sessionId = eventData.id;
      checkoutStatus = 'PAID';
    } else if (eventType === 'payment_intent.payment_failed') {
      sessionId = eventData.id;
      checkoutStatus = 'FAILED';
    } else if (eventType === 'checkout.session.async_payment_succeeded') {
      sessionId = eventData.id;
      checkoutStatus = 'PAID';
    } else if (eventType === 'checkout.session.async_payment_failed') {
      sessionId = eventData.id;
      checkoutStatus = 'FAILED';
    } else if (eventType === 'checkout.session.expired') {
      sessionId = eventData.id;
      checkoutStatus = 'CANCELLED';
    }

    if (!sessionId) {
      app.log.warn({ eventType, body }, 'Webhook reçu sans session_id identifiable');
      return reply.code(400).send({ error: 'session_id non identifiable dans l\'événement' });
    }

    // Mettre à jour les tickets associés uniquement pour les statuts finaux
    let ticketsUpdated = 0;
    if (checkoutStatus && (checkoutStatus === 'PAID' || checkoutStatus === 'FAILED' || checkoutStatus === 'CANCELLED')) {
      ticketsUpdated = await updateTicketsByCheckoutStatus(
        app,
        sessionId,
        checkoutStatus,
        eventData.payment_intent || checkoutStatus
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

    app.log.info(
      { sessionId, eventType, checkoutStatus, ticketsUpdated, qrCodesCount: qrCodes.length },
      'Webhook traité avec succès'
    );

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
      body: req.body
    }, 'Erreur lors du traitement du webhook');
    return reply.code(500).send({ error: 'Erreur lors du traitement du webhook' });
  }
}

/**
 * Enregistre les routes de paiement
 */
export function registerPayRoutes(app: FastifyInstance) {
  // Route pour vérifier le statut d'une session de checkout
  app.get<{ Params: { sessionId: string } }>(
    '/pay/checkout/:sessionId',
    {
      schema: getCheckoutStatusSchema,
    },
    async (req, reply) => getCheckoutStatusHandler(req, reply, app)
  );

  // Route publique pour recevoir les webhooks
  // Note: Le raw body est déjà disponible via le contentTypeParser global qui parse en string
  // On utilise JSON.stringify pour reconstruire le body (identique pour JSON valide)
  app.post<{ Body: WebhookBody }>(
    '/pay/webhook',
    {
      schema: webhookSchema,
    },
    async (req, reply) => webhookHandler(req, reply, app)
  );
}