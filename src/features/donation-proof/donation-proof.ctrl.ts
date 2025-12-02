import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { generateDonationProofSchema } from './donation-proof.schemas.ts';
import type { GenerateDonationProofQuery } from './donation-proof.types.ts';
import { getTicketById } from '../tickets/tickets.service.ts';
import { generateDonationProofFromTicket } from './donation-proof.service.ts';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';

/**
 * Handler pour générer et télécharger un certificat de don
 */
export async function generateDonationProofHandler(
  req: FastifyRequest<{ Querystring: GenerateDonationProofQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { ticket_id, address, postal_code, city } = req.query;

    if (!ticket_id) {
      return reply.code(400).send({ error: 'ticket_id est requis' });
    }

    // Récupérer le ticket
    const ticket = await getTicketById(app, ticket_id);

    if (!ticket) {
      return reply.code(404).send({ error: 'Ticket non trouvé' });
    }

    // Vérifier que le ticket a un don
    const donationAmount = typeof ticket.donation_amount === 'string'
      ? parseFloat(ticket.donation_amount)
      : ticket.donation_amount;

    if (!donationAmount || donationAmount <= 0) {
      return reply.code(400).send({ error: 'Ce ticket ne contient pas de don' });
    }

    // Générer le PDF
    const pdfBuffer = await generateDonationProofFromTicket(
      ticket,
      address,
      postal_code,
      city
    );

    if (!pdfBuffer) {
      return reply.code(400).send({ error: 'Impossible de générer le certificat de don' });
    }

    // Générer un nom de fichier
    const fileName = `certificat-don-${ticket.id.substring(0, 8)}.pdf`;

    // Envoyer le PDF
    reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(pdfBuffer);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la génération du certificat de don');
    return reply.code(500).send({ error: 'Erreur lors de la génération du certificat de don' });
  }
}

/**
 * Handler pour générer un certificat de don de debug avec des données de test
 */
export async function generateDonationProofDebugHandler(
  req: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { generateDonationProofPDF } = await import('./donation-proof.service.ts');

    // Données de test pour le debug
    const testData = {
      amount: 50.00,
      first_name: 'Jean',
      last_name: 'Dupont',
      address: '123 Rue de la République',
      postal_code: '75001',
      city: 'Paris',
      date: new Date(),
      invoice_id: 'TEST-12345',
    };

    // Générer le PDF
    const pdfBuffer = await generateDonationProofPDF(testData);

    // Générer un nom de fichier
    const fileName = 'certificat-don-debug.pdf';

    // Envoyer le PDF
    reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(pdfBuffer);
  } catch (err: any) {
    app.log.error({ err, errorMessage: err?.message, errorStack: err?.stack }, 'Erreur lors de la génération du certificat de don de debug');
    return reply.code(500).send({
      error: 'Erreur lors de la génération du certificat de don de debug',
      details: err?.message
    });
  }
}

/**
 * Enregistre les routes pour les certificats de don
 */
export function registerDonationProofRoutes(app: FastifyInstance) {
  // Route protégée : génération et téléchargement du certificat de don
  app.get<{ Querystring: GenerateDonationProofQuery }>(
    '/museum/donation-proof/generate',
    {
      schema: generateDonationProofSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => generateDonationProofHandler(req, reply, app)
  );

  // Route protégée : génération d'un certificat de debug avec des données de test
  app.get(
    '/museum/donation-proof/debug',
    {
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.dev, roles.bureau]),
      ],
    },
    async (req, reply) => generateDonationProofDebugHandler(req, reply, app)
  );
}

