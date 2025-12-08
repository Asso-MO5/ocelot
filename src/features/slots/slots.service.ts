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
 * Vérifie si un créneau correspond exactement à un créneau standard (complet)
 * Un créneau est "complet" s'il commence à une heure pile (14:00, 15:00, etc.)
 * et a une durée égale à slotCapacityHours
 * 
 * @param slotStart Heure de début du créneau (HH:MM:SS)
 * @param slotEnd Heure de fin du créneau (HH:MM:SS)
 * @param slotCapacityHours Durée standard d'un créneau en heures
 * @returns true si le créneau est complet, false sinon
 */
export function isSlotComplete(
  slotStart: string,
  slotEnd: string,
  slotCapacityHours: number
): boolean {
  const startMinutes = timeToMinutes(slotStart);
  const endMinutes = timeToMinutes(slotEnd);
  const slotCapacityMinutes = slotCapacityHours * 60;
  const startMins = startMinutes % 60;
  if (startMins !== 0) {
    return false;
  }

  // Vérifier que la durée correspond exactement à slotCapacityHours
  const actualDuration = endMinutes - startMinutes;
  return actualDuration === slotCapacityMinutes;
}

/**
 * Calcule le tarif ajusté pour un créneau (demi-tarif si incomplet, arrondi à l'inférieur)
 * 
 * @param basePrice Prix de base du tarif
 * @param slotStart Heure de début du créneau (HH:MM:SS)
 * @param slotEnd Heure de fin du créneau (HH:MM:SS)
 * @param slotCapacityHours Durée standard d'un créneau en heures
 * @returns Prix ajusté (demi-tarif si incomplet, arrondi à l'inférieur)
 */
export function calculateSlotPrice(
  basePrice: number,
  slotStart: string,
  slotEnd: string,
  slotCapacityHours: number
): number {
  if (isSlotComplete(slotStart, slotEnd, slotCapacityHours)) {
    return basePrice;
  }

  // Créneau incomplet : demi-tarif, arrondi à l'inférieur
  return Math.floor(basePrice / 2);
}

/**
 * Génère les slots pour une plage horaire donnée
 * Les créneaux sont générés par tranche de 1h (14h, 15h, 16h...)
 * Chaque créneau a une durée de slotCapacityHours à partir de l'heure de début
 * Exemple : si slotCapacityHours = 2, on génère 14h-16h, 15h-17h, 16h-18h...
 * Si il reste moins de slotCapacityHours avant la fermeture, on génère un créneau incomplet (1h minimum, demi-tarif)
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

  // Générer des créneaux toutes les heures (60 minutes)
  // Chaque créneau commence à une heure pile (14:00, 15:00, 16:00...)
  // et dure slotCapacityHours
  let currentStart = startMinutes;

  // Arrondir à l'heure inférieure pour commencer à une heure pile
  const hours = Math.floor(currentStart / 60);
  currentStart = hours * 60;

  // Générer les créneaux complets jusqu'à ce que le créneau suivant dépasse endTime
  while (currentStart + slotCapacityMinutes <= endMinutes) {
    const slotStart = minutesToTime(currentStart);
    const slotEnd = minutesToTime(currentStart + slotCapacityMinutes);
    slots.push({ start_time: slotStart, end_time: slotEnd });

    // Passer à l'heure suivante (60 minutes plus tard)
    currentStart += 60;
  }

  // Si il reste du temps (au moins 1 heure) mais pas assez pour un créneau complet,
  // générer un créneau incomplet (1h minimum, demi-tarif)
  const remainingMinutes = endMinutes - currentStart;
  if (remainingMinutes >= 60) {
    const slotStart = minutesToTime(currentStart);
    const slotEnd = minutesToTime(endMinutes);
    slots.push({ start_time: slotStart, end_time: slotEnd });
  }

  return slots;
}

/**
 * Compte le nombre de tickets qui se chevauchent avec un créneau donné
 * Un ticket se chevauche avec un créneau s'il commence avant la fin du créneau
 * et se termine après le début du créneau
 * 
 * Exemple : créneau 14h-16h
 * - Ticket 13h-15h : chevauche (se termine après 14h)
 * - Ticket 14h-16h : chevauche (identique)
 * - Ticket 15h-17h : chevauche (commence avant 16h)
 * - Ticket 16h-18h : chevauche (commence à 16h, se termine après 16h)
 * - Ticket 17h-19h : ne chevauche pas (commence après 16h)
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

  // Récupérer tous les tickets pour cette date qui se chevauchent avec ce créneau
  // Un ticket se chevauche s'il commence avant la fin du créneau ET se termine après le début du créneau
  const result = await app.pg.query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM tickets 
     WHERE reservation_date = $1 
     AND status IN ('pending', 'paid')
     AND slot_start_time < $3
     AND slot_end_time > $2`,
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

  // Générer les slots pour cet horaire
  const slotRanges = generateSlotsForSchedule(
    schedule.start_time,
    schedule.end_time,
    slotCapacityHours
  );

  // Pour chaque slot, compter les tickets et calculer la capacité
  const slots: Slot[] = [];

  // Récupérer le nombre total de tickets uniques pour cette date
  // (pour éviter de compter plusieurs fois le même ticket dans totalBooked)
  const uniqueTicketsResult = await app.pg.query<{ count: string }>(
    `SELECT COUNT(DISTINCT id) as count
     FROM tickets 
     WHERE reservation_date = $1 
     AND status IN ('pending', 'paid')`,
    [date]
  );
  const totalUniqueBooked = parseInt(uniqueTicketsResult.rows[0].count, 10);

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

    // Vérifier si le créneau est complet ou incomplet (demi-tarif)
    const isComplete = isSlotComplete(slotRange.start_time, slotRange.end_time, slotCapacityHours);
    const isHalfPrice = !isComplete;

    slots.push({
      start_time: slotRange.start_time,
      end_time: slotRange.end_time,
      capacity: dailyCapacity,
      booked,
      available,
      occupancy_percentage: occupancyPercentage,
      is_half_price: isHalfPrice,
    });
  }

  // Avec les créneaux qui se chevauchent, la capacité totale est plus complexe
  // On utilise le nombre de créneaux multiplié par la capacité quotidienne
  // mais on sait que les tickets peuvent se chevauchent
  const totalCapacity = slots.length * dailyCapacity;
  const totalAvailable = Math.max(0, totalCapacity - totalUniqueBooked);

  return {
    date,
    slots,
    total_capacity: totalCapacity,
    total_booked: totalUniqueBooked,
    total_available: totalAvailable,
  };
}

