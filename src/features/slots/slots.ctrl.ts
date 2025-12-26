import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { GetSlotsQuery, Slot } from './slots.types.ts';
import { getSlotsForDate } from './slots.service.ts';
import { getSlotsSchema } from './slots.schemas.ts';

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function filterSlotsForToday(slots: Slot[]): Slot[] {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return slots.filter(slot => {
    const slotStartMinutes = timeToMinutes(slot.start_time);
    const slotStartTime = new Date(now);
    slotStartTime.setHours(Math.floor(slotStartMinutes / 60), slotStartMinutes % 60, 0, 0);

    const slotEndTime = new Date(slotStartTime);
    const slotEndMinutes = timeToMinutes(slot.end_time);
    slotEndTime.setHours(Math.floor(slotEndMinutes / 60), slotEndMinutes % 60, 0, 0);

    if (now < slotStartTime) {
      return true;
    }

    if (now >= slotStartTime && now <= slotEndTime) {
      const minutesSinceStart = currentMinutes - slotStartMinutes;
      return minutesSinceStart <= 30;
    }

    return false;
  });
}

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

    const slotsResponse = await getSlotsForDate(app, date);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestedDate = new Date(date);
    requestedDate.setHours(0, 0, 0, 0);

    if (requestedDate.getTime() === today.getTime()) {
      const filteredSlots = filterSlotsForToday(slotsResponse.slots);
      const totalBooked = filteredSlots.reduce((sum, s) => sum + s.booked, 0);
      const totalCapacity = filteredSlots.reduce((sum, s) => sum + s.capacity, 0);
      const totalAvailable = filteredSlots.reduce((sum, s) => sum + s.available, 0);

      return reply.send({
        ...slotsResponse,
        slots: filteredSlots,
        total_capacity: totalCapacity,
        total_booked: totalBooked,
        total_available: totalAvailable,
      });
    }

    return reply.send(slotsResponse);
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

