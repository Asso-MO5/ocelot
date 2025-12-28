import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  UpsertPresenceBody,
  GetPresencesQuery,
} from './member-presences.types.ts';
import {
  upsertPresence,
  getPresencesForMember,
  getAllPresences,
  refusePresence,
  deletePresence,
} from './member-presences.service.ts';
import {
  upsertPresenceSchema,
  getPresencesSchema,
  refusePresenceSchema,
  deletePresenceSchema,
} from './member-presences.schemas.ts';
import { authenticateHook, requireAnyRole, hasAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';

export async function upsertPresenceHandler(
  req: FastifyRequest<{ Body: UpsertPresenceBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    if (!req.user) {
      return reply.code(401).send({ error: 'Non authentifié' });
    }

    const presence = await upsertPresence(app, req.user.id, req.body);
    return reply.send(presence);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la création/mise à jour de la présence');
    return reply.code(400).send({
      error: 'Erreur lors de la création/mise à jour de la présence',
      message: err.message,
    });
  }
}

export async function getPresencesHandler(
  req: FastifyRequest<{ Querystring: GetPresencesQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    if (!req.user) {
      return reply.code(401).send({ error: 'Non authentifié' });
    }

    const isAdmin = hasAnyRole(req.user, [roles.bureau, roles.dev]);

    let presences;
    if (isAdmin) {
      presences = await getAllPresences(app, req.query);
    } else {
      presences = await getAllPresences(app, req.query);
      //WARNING: pour le moment, les membres sont autorisés à voir comme les admins
      //presences = await getPresencesForMember(app, req.user.id, req.query);
    }

    return reply.send(presences);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération des présences');
    return reply.code(500).send({
      error: 'Erreur lors de la récupération des présences',
      message: err.message,
    });
  }
}
export async function refusePresenceHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: { refused: boolean } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    if (!req.user) {
      return reply.code(401).send({ error: 'Non authentifié' });
    }

    const presence = await refusePresence(app, req.params.id, req.body.refused);
    return reply.send(presence);
  } catch (err: any) {
    app.log.error({ err, params: req.params, body: req.body }, 'Erreur lors du refus de la présence');
    return reply.code(400).send({
      error: 'Erreur lors du refus de la présence',
      message: err.message,
    });
  }
}
export async function deletePresenceHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    if (!req.user) {
      return reply.code(401).send({ error: 'Non authentifié' });
    }

    const isAdmin = hasAnyRole(req.user, [roles.bureau, roles.dev]);
    const success = await deletePresence(app, req.params.id, req.user.id, isAdmin);

    if (!success) {
      return reply.code(404).send({
        error: 'Présence non trouvée',
      });
    }

    return reply.send({ success: true });
  } catch (err: any) {
    app.log.error({ err, params: req.params }, 'Erreur lors de la suppression de la présence');
    return reply.code(400).send({
      error: 'Erreur lors de la suppression de la présence',
      message: err.message,
    });
  }
}

export function registerMemberPresencesRoutes(app: FastifyInstance) {
  app.post<{ Body: UpsertPresenceBody }>('/museum/member-presences', {
    schema: upsertPresenceSchema,
    preHandler: [authenticateHook(app)],
    handler: (req, reply) => upsertPresenceHandler(req, reply, app),
  });

  app.get<{ Querystring: GetPresencesQuery }>('/museum/member-presences', {
    schema: getPresencesSchema,
    preHandler: [authenticateHook(app)],
    handler: (req, reply) => getPresencesHandler(req, reply, app),
  });

  app.put<{ Params: { id: string }; Body: { refused: boolean } }>('/museum/member-presences/:id/refuse', {
    schema: refusePresenceSchema,
    preHandler: [
      authenticateHook(app),
      requireAnyRole([roles.bureau, roles.dev]),
    ],
    handler: (req, reply) => refusePresenceHandler(req, reply, app),
  });

  app.delete<{ Params: { id: string } }>('/museum/member-presences/:id', {
    schema: deletePresenceSchema,
    preHandler: [authenticateHook(app)],
    handler: (req, reply) => deletePresenceHandler(req, reply, app),
  });
}

