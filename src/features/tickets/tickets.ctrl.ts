import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createTicket,
  createTicketsWithPayment,
  getTickets,
  getTicketById,
  getTicketByQRCode,
  getTicketsByCheckoutId,
  getTicketsStats,
  getWeeklySlotsStats,
  updateTicket,
  validateTicket,
  deleteTicket,
} from './tickets.service.ts';
import { generateTicketPDF } from './tickets.pdf.ts';
import type {
  CreateTicketBody,
  CreateTicketsWithPaymentBody,
  UpdateTicketBody,
  GetTicketsQuery,
  ValidateTicketBody,
  WeeklySlotsStats,
} from './tickets.types.ts';
import {
  createTicketSchema,
  createTicketsWithPaymentSchema,
  updateTicketSchema,
  getTicketsSchema,
  getTicketByIdSchema,
  getTicketsByCheckoutIdSchema,
  getTicketsStatsSchema,
  validateTicketSchema,
  deleteTicketSchema,
  getWeeklySlotsStatsSchema,
  resendTicketsByCheckoutIdSchema,
} from './tickets.schemas.ts';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';
import { handleStructuredError } from './tickets.errors.ts';
import { sendToRoom } from '../websocket/websocket.manager.ts';

export async function createTicketHandler(
  req: FastifyRequest<{ Body: CreateTicketBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const ticket = await createTicket(app, req.body);
    return reply.code(201).send(ticket);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la création du ticket');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    return reply.code(500).send({ error: 'Erreur lors de la création du ticket' });
  }
}

async function createTicketsWithPaymentHandler(
  req: FastifyRequest<{ Body: CreateTicketsWithPaymentBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const result = await createTicketsWithPayment(app, req.body);
    return reply.code(201).send(result);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la création des tickets avec paiement');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    if (err.message?.includes('STRIPE_SECRET_KEY')) {
      return reply.code(500).send({ error: 'Configuration Stripe manquante' });
    }

    const errorMessage = err.message || err.toString() || 'Erreur lors de la création des tickets avec paiement';
    return reply.code(500).send({ error: errorMessage });
  }
}

async function getTicketsHandler(
  req: FastifyRequest<{ Querystring: GetTicketsQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const tickets = await getTickets(app, req.query);
    return reply.send(tickets);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération des tickets');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    return reply.code(500).send({ error: 'Erreur lors de la récupération des tickets' });
  }
}

export async function getTicketByIdHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const ticket = await getTicketById(app, req.params.id);

    if (!ticket) {
      return reply.code(404).send({ error: 'Ticket non trouvé' });
    }

    return reply.send(ticket);
  } catch (err: any) {
    app.log.error({ err, id: req.params.id }, 'Erreur lors de la récupération du ticket');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    return reply.code(500).send({ error: 'Erreur lors de la récupération du ticket' });
  }
}

async function regenerateTicketPDFHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const ticket = await getTicketById(app, req.params.id);

    if (!ticket) {
      return reply.code(404).send({ error: 'Ticket non trouvé' });
    }

    if (ticket.status !== 'paid') {
      return reply.code(400).send({ error: 'Le ticket n\'est pas payé, PDF non généré' });
    }

    const pdfBuffer = await generateTicketPDF(ticket, true);

    if (!pdfBuffer) {
      return reply.code(400).send({ error: 'Impossible de générer le PDF du ticket' });
    }

    const fileName = `billet-${ticket.qr_code}.pdf`;

    reply
      .type('application/pdf')
      .header('Content-Disposition', `inline; filename="${fileName}"`)
      .send(pdfBuffer);
  } catch (err: any) {
    app.log.error({ err, id: req.params.id }, 'Erreur lors de la régénération du PDF du ticket');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    return reply.code(500).send({ error: 'Erreur lors de la régénération du PDF du ticket' });
  }
}

async function getTicketByQRCodeHandler(
  req: FastifyRequest<{ Params: { qrCode: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const ticket = await getTicketByQRCode(app, req.params.qrCode);

    if (!ticket) {
      return reply.code(404).send({ error: 'Ticket non trouvé' });
    }

    return reply.send(ticket);
  } catch (err: any) {
    app.log.error({ err, qrCode: req.params.qrCode }, 'Erreur lors de la récupération du ticket');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    return reply.code(500).send({ error: 'Erreur lors de la récupération du ticket' });
  }
}

async function viewTicketPageHandler(
  req: FastifyRequest<{ Params: { qrCode: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { getTicketByQRCode } = await import('./tickets.service.ts');
    const { generateTicketViewHTML } = await import('./tickets.email.ts');

    const ticket = await getTicketByQRCode(app, req.params.qrCode);

    if (!ticket) {
      return reply.code(404).type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Ticket non trouvé</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #e73b21; }
          </style>
        </head>
        <body>
          <h1>Ticket non trouvé</h1>
          <p>Le ticket demandé n'existe pas ou a été supprimé.</p>
        </body>
        </html>
      `);
    }

    const isValid = ticket.status === 'paid' && !ticket.used_at;
    const reservationDate = new Date(ticket.reservation_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    reservationDate.setHours(0, 0, 0, 0);
    const isDateValid = reservationDate >= today;

    if (!isValid || !isDateValid) {
      return reply.code(404).type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Billet invalide</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #e73b21; }
          </style>
        </head>
        <body>
          <h1>Billet invalide</h1>
          <p>Ce billet n'est plus valide ou a expiré.</p>
        </body>
        </html>
      `);
    }

    const html = await generateTicketViewHTML(ticket, true);

    return reply.type('text/html').send(html);
  } catch (err: any) {
    app.log.error({ err, qrCode: req.params.qrCode }, 'Erreur lors de la génération de la page de visualisation');
    return reply.code(500).type('text/html').send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Erreur</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #e73b21; }
        </style>
      </head>
      <body>
        <h1>Erreur</h1>
        <p>Une erreur est survenue lors du chargement du ticket.</p>
      </body>
      </html>
    `);
  }
}

async function getTicketsByCheckoutIdHandler(
  req: FastifyRequest<{ Params: { checkoutId: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const tickets = await getTicketsByCheckoutId(app, req.params.checkoutId);
    return reply.send(tickets);
  } catch (err: any) {
    app.log.error({ err, checkoutId: req.params.checkoutId }, 'Erreur lors de la récupération des tickets');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    return reply.code(500).send({ error: 'Erreur lors de la récupération des tickets' });
  }
}

async function getTicketsStatsHandler(
  _req: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const stats = await getTicketsStats(app);
    return reply.send({ tickets_stats: stats });
  } catch (err: any) {
    app.log.error({ err }, 'Erreur lors de la récupération des statistiques des tickets');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    return reply.code(500).send({ error: 'Erreur lors de la récupération des statistiques des tickets' });
  }
}

async function getWeeklySlotsStatsHandler(
  _req: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const stats: WeeklySlotsStats = await getWeeklySlotsStats(app);
    return reply.send(stats);
  } catch (err: any) {
    app.log.error({ err }, 'Erreur lors de la récupération des statistiques des créneaux de la semaine');
    return reply.code(500).send({ error: 'Erreur lors de la récupération des statistiques des créneaux de la semaine' });
  }
}

export async function updateTicketHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: UpdateTicketBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const ticket = await updateTicket(app, req.params.id, req.body);
    return reply.send(ticket);
  } catch (err: any) {
    app.log.error({ err, id: req.params.id, body: req.body }, 'Erreur lors de la mise à jour du ticket');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    if (err.message?.includes('non trouvé')) {
      return reply.code(404).send({ error: err.message });
    }

    if (
      err.message?.includes('doit être') ||
      err.message?.includes('ne peut pas être vide')
    ) {
      return reply.code(400).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors de la mise à jour du ticket' });
  }
}

export async function validateTicketHandler(
  req: FastifyRequest<{ Body: ValidateTicketBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const ticket = await validateTicket(app, req.body.qr_code);
    sendToRoom('tickets_stats', 'refetch')
    return reply.send(ticket);
  } catch (err: any) {
    app.log.error({ err, qr_code: req.body.qr_code }, 'Erreur lors de la validation du ticket');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    if (err.message?.includes('non trouvé')) {
      return reply.code(404).send({ error: err.message });
    }

    if (
      err.message?.includes('pas valide') ||
      err.message?.includes('déjà été utilisé') ||
      err.message?.includes('passée')
    ) {
      return reply.code(400).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors de la validation du ticket' });
  }
}

export async function deleteTicketHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const deleted = await deleteTicket(app, req.params.id);

    if (!deleted) {
      return reply.code(404).send({ error: 'Ticket non trouvé' });
    }

    return reply.code(204).send();
  } catch (err: any) {
    app.log.error({ err, id: req.params.id }, 'Erreur lors de la suppression du ticket');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    return reply.code(500).send({ error: 'Erreur lors de la suppression du ticket' });
  }
}

export async function resendTicketsByCheckoutIdHandler(
  req: FastifyRequest<{ Params: { checkoutId: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { checkoutId } = req.params;
    const tickets = await getTicketsByCheckoutId(app, checkoutId);

    if (tickets.length === 0) {
      return reply.code(404).send({ error: 'Aucun ticket trouvé pour ce checkout' });
    }

    const { sendTicketsConfirmationEmails } = await import('./tickets.email.ts');
    await sendTicketsConfirmationEmails(app, tickets);

    app.log.info({ checkoutId, ticketsCount: tickets.length }, 'Emails de tickets renvoyés');

    return reply.send({
      success: true,
      message: `${tickets.length} ticket(s) renvoyé(s) par email`,
      ticketsCount: tickets.length,
    });
  } catch (err: any) {
    app.log.error({ err, checkoutId: req.params.checkoutId }, 'Erreur lors du renvoi des tickets');

    const handled = handleStructuredError(err, reply);
    if (handled.sent) return;

    return reply.code(500).send({ error: 'Erreur lors du renvoi des tickets' });
  }
}

export function registerTicketsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: GetTicketsQuery }>(
    '/museum/tickets',
    {
      schema: getTicketsSchema,
    },
    async (req, reply) => getTicketsHandler(req, reply, app)
  );

  app.get<{ Params: { qrCode: string } }>(
    '/museum/tickets/qr/:qrCode',
    {
      schema: {
        params: {
          type: 'object',
          required: ['qrCode'],
          properties: {
            qrCode: {
              type: 'string',
              minLength: 8,
              maxLength: 8,
              pattern: '^[A-Z0-9]{8}$',
              description: 'Code QR du ticket (8 caractères alphanumériques majuscules)',
            },
          },
        },
        response: {
          200: getTicketByIdSchema.response[200],
          404: getTicketByIdSchema.response[404],
          500: getTicketByIdSchema.response[500],
        },
      },
    },
    async (req, reply) => getTicketByQRCodeHandler(req, reply, app)
  );

  app.post<{ Body: ValidateTicketBody }>(
    '/museum/tickets/validate',
    {
      schema: validateTicketSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => validateTicketHandler(req, reply, app)
  );

  app.get<{ Params: { id: string } }>(
    '/admin/tickets/:id/pdf',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => regenerateTicketPDFHandler(req, reply, app)
  );

  app.get<{ Params: { checkoutId: string } }>(
    '/museum/tickets/checkout/:checkoutId',
    {
      schema: getTicketsByCheckoutIdSchema,
    },
    async (req, reply) => getTicketsByCheckoutIdHandler(req, reply, app)
  );

  app.post<{ Params: { checkoutId: string } }>(
    '/museum/tickets/checkout/:checkoutId/resend',
    {
      schema: resendTicketsByCheckoutIdSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => resendTicketsByCheckoutIdHandler(req, reply, app)
  );

  app.get<{ Params: { qrCode: string } }>(
    '/tickets/:qrCode',
    async (req, reply) => viewTicketPageHandler(req, reply, app)
  );

  // Route publique : statistiques des tickets
  app.get(
    '/museum/tickets/stats',
    {
      schema: getTicketsStatsSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (_req, reply) => getTicketsStatsHandler(_req, reply, app)
  );

  app.get(
    '/museum/tickets/weekly-slots-stats',
    {
      schema: getWeeklySlotsStatsSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (_req, reply) => getWeeklySlotsStatsHandler(_req, reply, app)
  );

  app.get<{ Params: { id: string } }>(
    '/museum/tickets/:id',
    {
      schema: getTicketByIdSchema,
      preHandler: [authenticateHook(app)],
    },
    async (req, reply) => getTicketByIdHandler(req, reply, app)
  );

  app.post<{ Body: CreateTicketBody }>(
    '/museum/tickets',
    {
      schema: createTicketSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => createTicketHandler(req, reply, app)
  );

  app.post<{ Body: CreateTicketsWithPaymentBody }>(
    '/museum/tickets/payment',
    {
      schema: createTicketsWithPaymentSchema,
    },
    async (req, reply) => createTicketsWithPaymentHandler(req, reply, app)
  );

  app.put<{ Params: { id: string }; Body: UpdateTicketBody }>(
    '/museum/tickets/:id',
    {
      schema: updateTicketSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => updateTicketHandler(req, reply, app)
  );

  app.delete<{ Params: { id: string } }>(
    '/museum/tickets/:id',
    {
      schema: deleteTicketSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => deleteTicketHandler(req, reply, app)
  );
}

