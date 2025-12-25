import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { generateDonationProofSchema } from './donation-proof.schemas.ts';
import type { GenerateDonationProofQuery } from './donation-proof.types.ts';
import { getTicketById } from '../tickets/tickets.service.ts';
import { generateDonationProofFromTicket } from './donation-proof.service.ts';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';

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

    const ticket = await getTicketById(app, ticket_id);

    if (!ticket) {
      return reply.code(404).send({ error: 'Ticket non trouvé' });
    }

    const donationAmount = typeof ticket.donation_amount === 'string'
      ? parseFloat(ticket.donation_amount)
      : ticket.donation_amount;

    if (!donationAmount || donationAmount <= 0) {
      return reply.code(400).send({ error: 'Ce ticket ne contient pas de don' });
    }

    const pdfBuffer = await generateDonationProofFromTicket(
      ticket,
      address,
      postal_code,
      city
    );

    if (!pdfBuffer) {
      return reply.code(400).send({ error: 'Impossible de générer le certificat de don' });
    }

    const fileName = `certificat-don-${ticket.id.substring(0, 8)}.pdf`;

    reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(pdfBuffer);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la génération du certificat de don');
    return reply.code(500).send({ error: 'Erreur lors de la génération du certificat de don' });
  }
}

export async function generateDonationProofDebugHandler(
  req: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { generateDonationProofPDF } = await import('./donation-proof.service.ts');

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

    const pdfBuffer = await generateDonationProofPDF(testData);
    const fileName = 'certificat-don-debug.pdf';

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

export function registerDonationProofRoutes(app: FastifyInstance) {
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

