import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createSpecialPeriodSchema,
  updateSpecialPeriodSchema,
  getSpecialPeriodsSchema,
} from './special-periods.schemas.ts';
import type {
  CreateSpecialPeriodBody,
  UpdateSpecialPeriodBody,
  GetSpecialPeriodsQuery,
} from './special-periods.types.ts';
import {
  createSpecialPeriod,
  getSpecialPeriods,
  getSpecialPeriodById,
  updateSpecialPeriod,
  deleteSpecialPeriod,
} from './special-periods.service.ts';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';

export async function createSpecialPeriodHandler(
  req: FastifyRequest<{ Body: CreateSpecialPeriodBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const period = await createSpecialPeriod(app, req.body);
    return reply.code(201).send(period);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la création de la période spéciale');
    return reply.code(500).send({ error: err.message || 'Erreur lors de la création de la période spéciale' });
  }
}

async function getSpecialPeriodsHandler(
  req: FastifyRequest<{ Querystring: GetSpecialPeriodsQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const periods = await getSpecialPeriods(app, req.query);
    return reply.send(periods);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération des périodes spéciales');
    return reply.code(500).send({ error: 'Erreur lors de la récupération des périodes spéciales' });
  }
}

export async function getSpecialPeriodByIdHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const period = await getSpecialPeriodById(app, req.params.id);
    if (!period) {
      return reply.code(404).send({ error: 'Période spéciale non trouvée' });
    }
    return reply.send(period);
  } catch (err: any) {
    app.log.error({ err, id: req.params.id }, 'Erreur lors de la récupération de la période spéciale');
    return reply.code(500).send({ error: 'Erreur lors de la récupération de la période spéciale' });
  }
}

export async function updateSpecialPeriodHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: UpdateSpecialPeriodBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const period = await updateSpecialPeriod(app, req.params.id, req.body);
    return reply.send(period);
  } catch (err: any) {
    app.log.error({ err, id: req.params.id, body: req.body }, 'Erreur lors de la mise à jour de la période spéciale');
    if (err.message?.includes('non trouvée')) {
      return reply.code(404).send({ error: err.message });
    }
    return reply.code(500).send({ error: err.message || 'Erreur lors de la mise à jour de la période spéciale' });
  }
}

export async function deleteSpecialPeriodHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const deleted = await deleteSpecialPeriod(app, req.params.id);
    if (!deleted) {
      return reply.code(404).send({ error: 'Période spéciale non trouvée' });
    }
    return reply.code(204).send();
  } catch (err: any) {
    app.log.error({ err, id: req.params.id }, 'Erreur lors de la suppression de la période spéciale');
    return reply.code(500).send({ error: 'Erreur lors de la suppression de la période spéciale' });
  }
}

export function registerSpecialPeriodsRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateSpecialPeriodBody }>(
    '/museum/special-periods',
    {
      schema: createSpecialPeriodSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => createSpecialPeriodHandler(req, reply, app)
  );

  app.get<{ Querystring: GetSpecialPeriodsQuery }>(
    '/museum/special-periods',
    {
      schema: getSpecialPeriodsSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => getSpecialPeriodsHandler(req, reply, app)
  );

  app.get<{ Params: { id: string } }>(
    '/museum/special-periods/:id',
    {
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => getSpecialPeriodByIdHandler(req, reply, app)
  );

  app.put<{ Params: { id: string }; Body: UpdateSpecialPeriodBody }>(
    '/museum/special-periods/:id',
    {
      schema: updateSpecialPeriodSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => updateSpecialPeriodHandler(req, reply, app)
  );

  app.delete<{ Params: { id: string } }>(
    '/museum/special-periods/:id',
    {
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => deleteSpecialPeriodHandler(req, reply, app)
  );
}

