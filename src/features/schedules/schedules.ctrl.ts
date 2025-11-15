import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createSchedule,
  upsertSchedule,
  getSchedules,
  getPublicSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
} from './schedules.service.ts';
import type {
  CreateScheduleBody,
  UpdateScheduleBody,
  GetSchedulesQuery,
  GetPublicSchedulesQuery,
} from './schedules.types.ts';
import {
  createScheduleSchema,
  updateScheduleSchema,
  getSchedulesSchema,
  getPublicSchedulesSchema,
  getScheduleByIdSchema,
  deleteScheduleSchema,
} from './schedules.schemas.ts';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';

/**
 * Handler pour créer un horaire
 */
export async function createScheduleHandler(
  req: FastifyRequest<{ Body: CreateScheduleBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const schedule = await createSchedule(app, req.body);
    return reply.code(201).send(schedule);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la création de l\'horaire');

    if (err.message?.includes('requis') || err.message?.includes('requis')) {
      return reply.code(400).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors de la création de l\'horaire' });
  }
}

/**
 * Handler pour créer ou mettre à jour un horaire (UPSERT)
 */
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

/**
 * Handler pour récupérer tous les horaires (pour les membres authentifiés)
 */
export async function getSchedulesHandler(
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

/**
 * Handler pour récupérer uniquement les horaires publics (route publique)
 */
export async function getPublicSchedulesHandler(
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

/**
 * Handler pour récupérer un horaire par son ID
 */
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

/**
 * Handler pour mettre à jour un horaire
 */
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

/**
 * Handler pour supprimer un horaire
 */
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

/**
 * Enregistre les routes pour les horaires
 * 
 * Routes publiques : GET /museum/schedules/public (horaires publics uniquement)
 * Routes protégées membres : GET /museum/schedules (tous les horaires pour les membres authentifiés)
 * Routes protégées : POST, PUT, DELETE (écriture) - uniquement pour les rôles "bureau" et "dev"
 */
export function registerSchedulesRoutes(app: FastifyInstance) {
  // Route publique : horaires publics uniquement (pour le site public)
  app.get<{ Querystring: GetPublicSchedulesQuery }>(
    '/museum/schedules/public',
    {
      schema: getPublicSchedulesSchema,
    },
    async (req, reply) => getPublicSchedulesHandler(req, reply, app)
  );

  // Route protégée : tous les horaires (pour les membres authentifiés)
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

  // Routes protégées : modification des horaires (uniquement bureau et dev)
  // POST fait un UPSERT : crée ou met à jour selon les critères
  app.post<{ Body: CreateScheduleBody }>(
    '/museum/schedules',
    {
      schema: createScheduleSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
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
        requireAnyRole([roles.bureau, roles.dev]),
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
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => deleteScheduleHandler(req, reply, app)
  );
}

