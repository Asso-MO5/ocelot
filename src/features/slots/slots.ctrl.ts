import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { GetSlotsQuery } from './slots.types.ts';
import { getSlotsForDate } from './slots.service.ts';
import { getSlotsSchema } from './slots.schemas.ts';

export async function getSlotsHandler(
  req: FastifyRequest<{ Querystring: GetSlotsQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { date } = req.query;

    if (!date) {
      return reply.code(400).send({ error: 'Le paramètre date est requis' });
    }

    const slots = await getSlotsForDate(app, date);
    return reply.send(slots);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération des créneaux');

    if (err.message?.includes('Format de date invalide')) {
      return reply.code(400).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors de la récupération des créneaux' });
  }
}

export function registerSlotsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: GetSlotsQuery }>(
    '/museum/slots',
    {
      schema: getSlotsSchema,
    },
    async (req, reply) => getSlotsHandler(req, reply, app)
  );
}

