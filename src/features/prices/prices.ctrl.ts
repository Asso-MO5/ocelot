import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createPrice,
  getPrices,
  getPriceById,
  updatePrice,
  deletePrice,
  reorderPrices,
} from './prices.service.ts';
import type {
  CreatePriceBody,
  UpdatePriceBody,
  GetPricesQuery,
  ReorderPricesBody,
} from './prices.types.ts';
import {
  createPriceSchema,
  updatePriceSchema,
  getPricesSchema,
  getPriceByIdSchema,
  deletePriceSchema,
  reorderPricesSchema,
} from './prices.schemas.ts';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';

export async function createPriceHandler(
  req: FastifyRequest<{ Body: CreatePriceBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { price, isUpdate } = await createPrice(app, req.body);

    return reply.code(isUpdate ? 200 : 201).send(price);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la création/mise à jour du tarif');

    if (
      err.message?.includes('requis') ||
      err.message?.includes('doit être') ||
      err.message?.includes('doivent être') ||
      err.message?.includes('antérieure') ||
      err.message?.includes('Au moins une traduction')
    ) {
      return reply.code(400).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors de la création/mise à jour du tarif' });
  }
}

export async function getPricesHandler(
  req: FastifyRequest<{ Querystring: GetPricesQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const prices = await getPrices(app, req.query);

    const { getSettingValue } = await import('../settings/settings.service.ts');
    const guidedTourPrice = await getSettingValue<number>(app, 'guided_tour_price', 0);

    return reply.send({
      prices,
      guided_tour_price: guidedTourPrice ?? null,
    });
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération des tarifs');
    return reply.code(500).send({ error: 'Erreur lors de la récupération des tarifs' });
  }
}

export async function getPriceByIdHandler(
  req: FastifyRequest<{ Params: { id: string }; Querystring: { lang?: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const price = await getPriceById(app, req.params.id, req.query.lang);

    if (!price) {
      return reply.code(404).send({ error: 'Tarif non trouvé' });
    }

    return reply.send(price);
  } catch (err: any) {
    app.log.error({ err, id: req.params.id }, 'Erreur lors de la récupération du tarif');
    return reply.code(500).send({ error: 'Erreur lors de la récupération du tarif' });
  }
}

export async function updatePriceHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: UpdatePriceBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const price = await updatePrice(app, req.params.id, req.body);
    return reply.send(price);
  } catch (err: any) {
    app.log.error({ err, id: req.params.id, body: req.body }, 'Erreur lors de la mise à jour du tarif');

    if (err.message?.includes('non trouvé')) {
      return reply.code(404).send({ error: err.message });
    }

    if (err.message?.includes('doit être') || err.message?.includes('requis')) {
      return reply.code(400).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors de la mise à jour du tarif' });
  }
}

export async function deletePriceHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const deleted = await deletePrice(app, req.params.id);

    if (!deleted) {
      return reply.code(404).send({ error: 'Tarif non trouvé' });
    }

    return reply.code(204).send();
  } catch (err: any) {
    app.log.error({ err, id: req.params.id }, 'Erreur lors de la suppression du tarif');
    return reply.code(500).send({ error: 'Erreur lors de la suppression du tarif' });
  }
}

export async function reorderPricesHandler(
  req: FastifyRequest<{ Body: ReorderPricesBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const prices = await reorderPrices(app, req.body);
    return reply.send(prices);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors du réordonnancement des tarifs');

    if (err.message?.includes('vide') || err.message?.includes('invalides')) {
      return reply.code(400).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors du réordonnancement des tarifs' });
  }
}

export function registerPricesRoutes(app: FastifyInstance) {
  app.get<{ Querystring: GetPricesQuery }>(
    '/museum/prices',
    {
      schema: getPricesSchema,
    },
    async (req, reply) => getPricesHandler(req, reply, app)
  );

  app.get<{ Params: { id: string }; Querystring: { lang?: string } }>(
    '/museum/prices/:id',
    {
      schema: getPriceByIdSchema,
    },
    async (req, reply) => getPriceByIdHandler(req, reply, app)
  );

  app.post<{ Body: CreatePriceBody }>(
    '/museum/prices',
    {
      schema: createPriceSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => createPriceHandler(req, reply, app)
  );

  app.put<{ Params: { id: string }; Body: UpdatePriceBody }>(
    '/museum/prices/:id',
    {
      schema: updatePriceSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => updatePriceHandler(req, reply, app)
  );

  app.delete<{ Params: { id: string } }>(
    '/museum/prices/:id',
    {
      schema: deletePriceSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => deletePriceHandler(req, reply, app)
  );

  app.post<{ Body: ReorderPricesBody }>(
    '/museum/prices/reorder',
    {
      schema: reorderPricesSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => reorderPricesHandler(req, reply, app)
  );
}

