import type { FastifyInstance } from 'fastify';
import type { Slot, GetSlotsResponse } from './slots.types.ts';
import { getPublicSchedules } from '../schedules/schedules.service.ts';
import { getSettingValue } from '../settings/settings.service.ts';
import type { Schedule } from '../schedules/schedules.types.ts';
import type { Ticket } from '../tickets/tickets.types.ts';

/**
 * Convertit une heure HH:MM:SS en minutes depuis minuit
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convertit des minutes depuis minuit en heure HH:MM:SS
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
}

/**
 * Génère les slots pour une plage horaire donnée
 */
function generateSlotsForSchedule(
  startTime: string,
  endTime: string,
  slotCapacityHours: number
): Array<{ start_time: string; end_time: string }> {
  const slots: Array<{ start_time: string; end_time: string }> = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const slotCapacityMinutes = slotCapacityHours * 60;

  let currentStart = startMinutes;


  while (currentStart + slotCapacityMinutes <= endMinutes) {
    const slotStart = minutesToTime(currentStart);
    const slotEnd = minutesToTime(currentStart + slotCapacityMinutes);
    slots.push({ start_time: slotStart, end_time: slotEnd });
    currentStart += slotCapacityMinutes;
  }

  return slots;
}

/**
 * Compte le nombre de tickets pour un créneau donné
 * Un ticket est compté dans un créneau si son heure de début est dans ce créneau
 */
async function countTicketsForSlot(
  app: FastifyInstance,
  date: string,
  slotStart: string,
  slotEnd: string
): Promise<number> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Récupérer tous les tickets pour cette date qui commencent dans ce créneau
  const result = await app.pg.query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM tickets 
     WHERE reservation_date = $1 
     AND status IN ('pending', 'paid')
     AND slot_start_time >= $2
     AND slot_start_time < $3`,
    [date, slotStart, slotEnd]
  );

  return parseInt(result.rows[0].count, 10);
}

/**
 * Récupère les horaires pour une date donnée en priorisant les exceptions
 */
async function getScheduleForDate(
  app: FastifyInstance,
  date: string
): Promise<Schedule | null> {
  const schedules = await getPublicSchedules(app, { date });

  console.log('schedules', schedules);
  if (schedules.length === 0) {
    return null;
  }

  // Prioriser les exceptions (is_exception = true)
  const exceptions = schedules.filter(s => s.is_exception && !s.is_closed);
  if (exceptions.length > 0) {
    // Prendre la première exception (normalement il n'y en a qu'une par date)
    return exceptions[0];
  }

  // Sinon, prendre le premier horaire récurrent
  const regularSchedules = schedules.filter(s => !s.is_exception && !s.is_closed);
  if (regularSchedules.length > 0) {
    return regularSchedules[0];
  }

  // Si tous les horaires sont fermés, retourner null
  return null;
}

/**
 * Récupère les créneaux horaires pour une date donnée
 */
export async function getSlotsForDate(
  app: FastifyInstance,
  date: string
): Promise<GetSlotsResponse> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Valider le format de date
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new Error('Format de date invalide. Format attendu: YYYY-MM-DD');
  }

  // Récupérer l'horaire pour cette date
  const schedule = await getScheduleForDate(app, date);

  console.log('schedule', schedule, date, new Date(date).getDay());

  if (!schedule) {
    // Pas d'horaire trouvé ou musée fermé
    return {
      date,
      slots: [],
      total_capacity: 0,
      total_booked: 0,
      total_available: 0,
    };
  }

  // Si le musée est fermé ce jour-là
  if (schedule.is_closed) {
    return {
      date,
      slots: [],
      total_capacity: 0,
      total_booked: 0,
      total_available: 0,
    };
  }

  // Récupérer les settings
  const slotCapacityHours = (await getSettingValue<number>(app, 'slot_capacity', 1)) || 1;
  const dailyCapacity = (await getSettingValue<number>(app, 'capacity', 100)) || 100;


  console.log('schedule.start_time', schedule.start_time);
  // Générer les slots pour cet horaire
  const slotRanges = generateSlotsForSchedule(
    schedule.start_time,
    schedule.end_time,
    slotCapacityHours
  );

  // Pour chaque slot, compter les tickets et calculer la capacité
  const slots: Slot[] = [];

  console.log('slotRanges', slotRanges);
  let totalBooked = 0;

  for (const slotRange of slotRanges) {
    const booked = await countTicketsForSlot(
      app,
      date,
      slotRange.start_time,
      slotRange.end_time
    );

    const available = Math.max(0, dailyCapacity - booked);
    const occupancyPercentage = dailyCapacity > 0
      ? Math.round((booked / dailyCapacity) * 100)
      : 0;

    slots.push({
      start_time: slotRange.start_time,
      end_time: slotRange.end_time,
      capacity: dailyCapacity,
      booked,
      available,
      occupancy_percentage: occupancyPercentage,
    });

    totalBooked += booked;
  }

  const totalCapacity = slots.length * dailyCapacity;
  const totalAvailable = totalCapacity - totalBooked;

  return {
    date,
    slots,
    total_capacity: totalCapacity,
    total_booked: totalBooked,
    total_available: totalAvailable,
  };
}

