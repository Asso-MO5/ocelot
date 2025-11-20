import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  upsertSetting,
  getSettings,
  getSettingByKey,
  deleteSetting,
  getMaxCapacity,
  setMaxCapacity,
  getCurrentVisitors,
  setCurrentVisitors,
  incrementVisitors,
  decrementVisitors,
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
  getCurrentVisitorsSchema,
  setCurrentVisitorsSchema,
  incrementVisitorsSchema,
  decrementVisitorsSchema,
} from './settings.schemas.ts';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';

/**
 * Handler pour créer ou mettre à jour un paramètre
 */
export async function upsertSettingHandler(
  req: FastifyRequest<{ Body: UpsertSettingBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    // Vérifier si le paramètre existe déjà
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

/**
 * Handler pour récupérer tous les paramètres
 */
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

/**
 * Handler pour récupérer un paramètre par sa clé
 */
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

/**
 * Handler pour supprimer un paramètre
 */
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

/**
 * Handler pour récupérer la capacité maximale
 */
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

/**
 * Handler pour définir la capacité maximale
 */
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

    (app.ws as any).send('capacity', 'refetch')
    return reply.send(setting);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la définition de la capacité maximale');
    return reply.code(500).send({ error: 'Erreur lors de la définition de la capacité maximale' });
  }
}

/**
 * Handler pour récupérer le nombre actuel de visiteurs
 */
export async function getCurrentVisitorsHandler(
  _req: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const visitors = await getCurrentVisitors(app);
    return reply.send({ current_visitors: visitors });
  } catch (err: any) {
    app.log.error({ err }, 'Erreur lors de la récupération du nombre de visiteurs');
    return reply.code(500).send({ error: 'Erreur lors de la récupération du nombre de visiteurs' });
  }
}

/**
 * Handler pour définir le nombre actuel de visiteurs
 */
export async function setCurrentVisitorsHandler(
  req: FastifyRequest<{ Body: { current_visitors: number } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { current_visitors } = req.body;

    if (current_visitors < 0) {
      return reply.code(400).send({ error: 'Le nombre de visiteurs doit être positif ou nul' });
    }

    const setting = await setCurrentVisitors(app, current_visitors);

    (app.ws as any).send('capacity', 'refetch')
    return reply.send(setting);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la définition du nombre de visiteurs');
    return reply.code(500).send({ error: 'Erreur lors de la définition du nombre de visiteurs' });
  }
}

/**
 * Handler pour incrémenter le nombre de visiteurs
 */
export async function incrementVisitorsHandler(
  req: FastifyRequest<{ Body?: { increment?: number } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const increment = req.body?.increment ?? 1;
    const newCount = await incrementVisitors(app, increment);
    // Diffuser le changement via WebSocket
    (app.ws as any).send('capacity', 'refetch')
    return reply.send({ current_visitors: newCount });
  } catch (err: any) {
    app.log.error({ err }, 'Erreur lors de l\'incrémentation du nombre de visiteurs');
    return reply.code(500).send({ error: 'Erreur lors de l\'incrémentation du nombre de visiteurs' });
  }
}

/**
 * Handler pour décrémenter le nombre de visiteurs
 */
export async function decrementVisitorsHandler(
  req: FastifyRequest<{ Body?: { decrement?: number } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const decrement = req.body?.decrement ?? 1;
    const newCount = await decrementVisitors(app, decrement);
    (app.ws as any).send('current_visitors', 'refetch')
    return reply.send({ current_visitors: newCount });
  } catch (err: any) {
    app.log.error({ err }, 'Erreur lors de la décrémentation du nombre de visiteurs');
    return reply.code(500).send({ error: 'Erreur lors de la décrémentation du nombre de visiteurs' });
  }
}

/**
 * Enregistre les routes pour les paramètres du musée
 * 
 * Routes publiques : GET (lecture)
 * Routes protégées : POST, PUT, DELETE (écriture) - uniquement pour les rôles "bureau" et "dev"
 */
export function registerSettingsRoutes(app: FastifyInstance) {
  // Routes publiques : lecture des paramètres
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

  // Routes publiques spécifiques pour la capacité
  app.get(
    '/museum/capacity/max',
    {
      schema: getMaxCapacitySchema,
    },
    async (_req, reply) => getMaxCapacityHandler(_req, reply, app)
  );

  app.get(
    '/museum/capacity/current',
    {
      schema: getCurrentVisitorsSchema,
    },
    async (_req, reply) => getCurrentVisitorsHandler(_req, reply, app)
  );


  // Routes protégées : modification des paramètres (uniquement bureau et dev)
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

  // Routes protégées spécifiques pour la capacité
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

  app.post<{ Body: { current_visitors: number } }>(
    '/museum/capacity/current',
    {
      schema: setCurrentVisitorsSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => setCurrentVisitorsHandler(req, reply, app)
  );

  app.post<{ Body?: { increment?: number } }>(
    '/museum/capacity/increment',
    {
      schema: incrementVisitorsSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => incrementVisitorsHandler(req, reply, app)
  );

  app.post<{ Body?: { decrement?: number } }>(
    '/museum/capacity/decrement',
    {
      schema: decrementVisitorsSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => decrementVisitorsHandler(req, reply, app)
  );
}

