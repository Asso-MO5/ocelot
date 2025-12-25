import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  upsertSchedule,
  getSchedules,
  getPublicSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  reorderSchedules,
} from './schedules.service.ts';
import type {
  CreateScheduleBody,
  UpdateScheduleBody,
  GetSchedulesQuery,
  GetPublicSchedulesQuery,
  ReorderSchedulesBody,
} from './schedules.types.ts';
import {
  createScheduleSchema,
  updateScheduleSchema,
  getSchedulesSchema,
  getPublicSchedulesSchema,
  getScheduleByIdSchema,
  deleteScheduleSchema,
  reorderSchedulesSchema,
} from './schedules.schemas.ts';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';

export async function upsertScheduleHandler(
  req: FastifyRequest<{ Body: CreateScheduleBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { schedule, created } = await upsertSchedule(app, req.body);
    return reply.code(created ? 201 : 200).send(schedule);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la création/mise à jour de l\'horaire');

    if (err.message?.includes('requis')) {
      return reply.code(400).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors de la création/mise à jour de l\'horaire' });
  }
}


async function getSchedulesHandler(
  req: FastifyRequest<{ Querystring: GetSchedulesQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {

  try {
    const schedules = await getSchedules(app, req.query);
    return reply.send(schedules);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération des horaires');
    return reply.code(500).send({ error: 'Erreur lors de la récupération des horaires' });
  }
}

async function getPublicSchedulesHandler(
  req: FastifyRequest<{ Querystring: GetPublicSchedulesQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const schedules = await getPublicSchedules(app, req.query);
    return reply.send(schedules);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération des horaires publics');
    return reply.code(500).send({ error: 'Erreur lors de la récupération des horaires publics' });
  }
}

export async function getScheduleByIdHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const schedule = await getScheduleById(app, req.params.id);

    if (!schedule) {
      return reply.code(404).send({ error: 'Horaire non trouvé' });
    }

    return reply.send(schedule);
  } catch (err: any) {
    app.log.error({ err, id: req.params.id }, 'Erreur lors de la récupération de l\'horaire');
    return reply.code(500).send({ error: 'Erreur lors de la récupération de l\'horaire' });
  }
}

export async function updateScheduleHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: UpdateScheduleBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const schedule = await updateSchedule(app, req.params.id, req.body);
    return reply.send(schedule);
  } catch (err: any) {
    app.log.error({ err, id: req.params.id, body: req.body }, 'Erreur lors de la mise à jour de l\'horaire');

    if (err.message?.includes('non trouvé')) {
      return reply.code(404).send({ error: err.message });
    }

    if (err.message?.includes('requis')) {
      return reply.code(400).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors de la mise à jour de l\'horaire' });
  }
}

export async function deleteScheduleHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const deleted = await deleteSchedule(app, req.params.id);

    if (!deleted) {
      return reply.code(404).send({ error: 'Horaire non trouvé' });
    }

    return reply.code(204).send();
  } catch (err: any) {
    app.log.error({ err, id: req.params.id }, 'Erreur lors de la suppression de l\'horaire');
    return reply.code(500).send({ error: 'Erreur lors de la suppression de l\'horaire' });
  }
}

export async function reorderSchedulesHandler(
  req: FastifyRequest<{ Body: ReorderSchedulesBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const schedules = await reorderSchedules(app, req.body);
    return reply.send(schedules);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors du réordonnancement des horaires');

    if (err.message?.includes('vide') || err.message?.includes('invalides')) {
      return reply.code(400).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors du réordonnancement des horaires' });
  }
}

export function registerSchedulesRoutes(app: FastifyInstance) {
  app.get<{ Querystring: GetPublicSchedulesQuery }>(
    '/museum/schedules/public',
    {
      schema: getPublicSchedulesSchema,
    },
    async (req, reply) => getPublicSchedulesHandler(req, reply, app)
  );

  app.get<{ Querystring: GetSchedulesQuery }>(
    '/museum/schedules',
    {
      schema: getSchedulesSchema,
      preHandler: [authenticateHook(app)],
    },
    async (req, reply) => getSchedulesHandler(req, reply, app)
  );

  app.get<{ Params: { id: string } }>(
    '/museum/schedules/:id',
    {
      schema: getScheduleByIdSchema,
    },
    async (req, reply) => getScheduleByIdHandler(req, reply, app)
  );

  app.post<{ Body: CreateScheduleBody }>(
    '/museum/schedules',
    {
      schema: createScheduleSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => upsertScheduleHandler(req, reply, app)
  );

  app.put<{ Params: { id: string }; Body: UpdateScheduleBody }>(
    '/museum/schedules/:id',
    {
      schema: updateScheduleSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => updateScheduleHandler(req, reply, app)
  );

  app.delete<{ Params: { id: string } }>(
    '/museum/schedules/:id',
    {
      schema: deleteScheduleSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => deleteScheduleHandler(req, reply, app)
  );

  app.post<{ Body: ReorderSchedulesBody }>(
    '/museum/schedules/reorder',
    {
      schema: reorderSchedulesSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => reorderSchedulesHandler(req, reply, app)
  );
}

