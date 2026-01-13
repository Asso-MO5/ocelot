import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  upsertSetting,
  getSettings,
  getSettingByKey,
  deleteSetting,
  getMaxCapacity,
  setMaxCapacity,
} from './settings.service.ts';
import type {
  UpsertSettingBody,
  GetSettingsQuery,
} from './settings.types.ts';
import {
  upsertSettingSchema,
  getSettingsSchema,
  getSettingByKeySchema,
  deleteSettingSchema,
  getMaxCapacitySchema,
  setMaxCapacitySchema,
} from './settings.schemas.ts';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';
import { sendToRoom } from '../websocket/websocket.manager.ts';

export async function upsertSettingHandler(
  req: FastifyRequest<{ Body: UpsertSettingBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const existing = await getSettingByKey(app, req.body.key);
    const setting = await upsertSetting(app, req.body);

    return reply.code(existing ? 200 : 201).send(setting);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la création/mise à jour du paramètre');

    if (err.message?.includes('convertie') || err.message?.includes('JSON')) {
      return reply.code(400).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors de la création/mise à jour du paramètre' });
  }
}

export async function getSettingsHandler(
  req: FastifyRequest<{ Querystring: GetSettingsQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const settings = await getSettings(app, req.query);
    return reply.send(settings);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération des paramètres');
    return reply.code(500).send({ error: 'Erreur lors de la récupération des paramètres' });
  }
}

export async function getSettingByKeyHandler(
  req: FastifyRequest<{ Params: { key: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const setting = await getSettingByKey(app, req.params.key);

    if (!setting) {
      return reply.code(404).send({ error: 'Paramètre non trouvé' });
    }

    return reply.send(setting);
  } catch (err: any) {
    app.log.error({ err, key: req.params.key }, 'Erreur lors de la récupération du paramètre');
    return reply.code(500).send({ error: 'Erreur lors de la récupération du paramètre' });
  }
}

export async function deleteSettingHandler(
  req: FastifyRequest<{ Params: { key: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const deleted = await deleteSetting(app, req.params.key);

    if (!deleted) {
      return reply.code(404).send({ error: 'Paramètre non trouvé' });
    }

    return reply.code(204).send();
  } catch (err: any) {
    app.log.error({ err, key: req.params.key }, 'Erreur lors de la suppression du paramètre');
    return reply.code(500).send({ error: 'Erreur lors de la suppression du paramètre' });
  }
}

export async function getMaxCapacityHandler(
  _req: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const capacity = await getMaxCapacity(app);
    return reply.send({ max_capacity: capacity });
  } catch (err: any) {
    app.log.error({ err }, 'Erreur lors de la récupération de la capacité maximale');
    return reply.code(500).send({ error: 'Erreur lors de la récupération de la capacité maximale' });
  }
}
export async function setMaxCapacityHandler(
  req: FastifyRequest<{ Body: { max_capacity: number } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { max_capacity } = req.body;

    if (max_capacity < 0) {
      return reply.code(400).send({ error: 'La capacité maximale doit être positive ou nulle' });
    }

    const setting = await setMaxCapacity(app, max_capacity);

    sendToRoom('capacity', 'refetch');
    return reply.send(setting);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la définition de la capacité maximale');
    return reply.code(500).send({ error: 'Erreur lors de la définition de la capacité maximale' });
  }
}



export function registerSettingsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: GetSettingsQuery }>(
    '/museum/settings',
    {
      schema: getSettingsSchema,
    },
    async (req, reply) => getSettingsHandler(req, reply, app)
  );

  app.get<{ Params: { key: string } }>(
    '/museum/settings/:key',
    {
      schema: getSettingByKeySchema,
    },
    async (req, reply) => getSettingByKeyHandler(req, reply, app)
  );

  app.get(
    '/museum/capacity/max',
    {
      schema: getMaxCapacitySchema,
    },
    async (_req, reply) => getMaxCapacityHandler(_req, reply, app)
  );

  app.post<{ Body: UpsertSettingBody }>(
    '/museum/settings',
    {
      schema: upsertSettingSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => upsertSettingHandler(req, reply, app)
  );

  app.put<{ Body: UpsertSettingBody }>(
    '/museum/settings',
    {
      schema: upsertSettingSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => upsertSettingHandler(req, reply, app)
  );

  app.delete<{ Params: { key: string } }>(
    '/museum/settings/:key',
    {
      schema: deleteSettingSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => deleteSettingHandler(req, reply, app)
  );

  app.post<{ Body: { max_capacity: number } }>(
    '/museum/capacity/max',
    {
      schema: setMaxCapacitySchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => setMaxCapacityHandler(req, reply, app)
  );
}

