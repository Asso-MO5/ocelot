import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  CreateEventBody,
  UpdateEventBody,
  GetEventsQuery,
  GetCalendarQuery,
} from './events.types.ts';
import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getCalendar,
} from './events.service.ts';
import {
  createEventSchema,
  updateEventSchema,
  getEventsSchema,
  getEventByIdSchema,
  deleteEventSchema,
  getCalendarSchema,
} from './events.schemas.ts';

/**
 * Handler pour créer un événement
 */
export async function createEventHandler(
  req: FastifyRequest<{ Body: CreateEventBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const event = await createEvent(app, req.body);
    return reply.code(201).send(event);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la création de l\'événement');
    return reply.code(400).send({
      error: 'Erreur lors de la création de l\'événement',
      message: err.message,
    });
  }
}

/**
 * Handler pour récupérer les événements
 */
export async function getEventsHandler(
  req: FastifyRequest<{ Querystring: GetEventsQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const result = await getEvents(app, req.query);
    return reply.send(result);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération des événements');
    return reply.code(500).send({
      error: 'Erreur lors de la récupération des événements',
      message: err.message,
    });
  }
}

/**
 * Handler pour récupérer un événement par son ID
 */
export async function getEventByIdHandler(
  req: FastifyRequest<{ Params: { id: string }; Querystring: { include_relations?: boolean } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const event = await getEventById(app, req.params.id, req.query.include_relations ?? false);
    if (!event) {
      return reply.code(404).send({
        error: 'Événement non trouvé',
      });
    }
    return reply.send(event);
  } catch (err: any) {
    app.log.error({ err, id: req.params.id }, 'Erreur lors de la récupération de l\'événement');
    return reply.code(500).send({
      error: 'Erreur lors de la récupération de l\'événement',
      message: err.message,
    });
  }
}

/**
 * Handler pour mettre à jour un événement
 */
export async function updateEventHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: UpdateEventBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const event = await updateEvent(app, req.params.id, req.body);
    return reply.send(event);
  } catch (err: any) {
    app.log.error({ err, id: req.params.id, body: req.body }, 'Erreur lors de la mise à jour de l\'événement');
    if (err.message.includes('non trouvé')) {
      return reply.code(404).send({
        error: 'Événement non trouvé',
        message: err.message,
      });
    }
    return reply.code(400).send({
      error: 'Erreur lors de la mise à jour de l\'événement',
      message: err.message,
    });
  }
}

/**
 * Handler pour supprimer un événement
 */
export async function deleteEventHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const deleted = await deleteEvent(app, req.params.id);
    if (!deleted) {
      return reply.code(404).send({
        error: 'Événement non trouvé',
      });
    }
    return reply.send({ success: true });
  } catch (err: any) {
    app.log.error({ err, id: req.params.id }, 'Erreur lors de la suppression de l\'événement');
    return reply.code(500).send({
      error: 'Erreur lors de la suppression de l\'événement',
      message: err.message,
    });
  }
}

/**
 * Handler pour récupérer le calendrier
 */
export async function getCalendarHandler(
  req: FastifyRequest<{ Querystring: GetCalendarQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const calendar = await getCalendar(app, req.query);
    return reply.send(calendar);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération du calendrier');
    return reply.code(500).send({
      error: 'Erreur lors de la récupération du calendrier',
      message: err.message,
    });
  }
}

/**
 * Enregistre les routes des événements
 */
export function registerEventsRoutes(app: FastifyInstance) {
  // CRUD des événements (routes globales, pas uniquement musée)
  app.post('/events', {
    schema: createEventSchema,
    handler: (req, reply) => createEventHandler(req, reply, app),
  });

  app.get('/events', {
    schema: getEventsSchema,
    handler: (req, reply) => getEventsHandler(req, reply, app),
  });

  app.get('/events/:id', {
    schema: getEventByIdSchema,
    handler: (req, reply) => getEventByIdHandler(req, reply, app),
  });

  app.put('/events/:id', {
    schema: updateEventSchema,
    handler: (req, reply) => updateEventHandler(req, reply, app),
  });

  app.delete('/events/:id', {
    schema: deleteEventSchema,
    handler: (req, reply) => deleteEventHandler(req, reply, app),
  });

  // Calendrier du musée (reste sous /museum car c'est spécifique au musée)
  app.get('/museum/calendar', {
    schema: getCalendarSchema,
    handler: (req, reply) => getCalendarHandler(req, reply, app),
  });
}

