import type { FastifyInstance } from 'fastify';
import type { Slot, GetSlotsResponse } from './slots.types.ts';
import { getPublicSchedules } from '../schedules/schedules.service.ts';
import { getSettingValue } from '../settings/settings.service.ts';
import type { Schedule } from '../schedules/schedules.types.ts';

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
}

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

  const actualDuration = endMinutes - startMinutes;
  return actualDuration === slotCapacityMinutes;
}

export function calculateSlotPrice(
  basePrice: number,
  slotStart: string,
  slotEnd: string,
  slotCapacityHours: number
): number {
  if (isSlotComplete(slotStart, slotEnd, slotCapacityHours)) {
    return basePrice;
  }

  return Math.round(basePrice / 2);
}

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

  const hours = Math.floor(currentStart / 60);
  currentStart = hours * 60;

  while (currentStart + slotCapacityMinutes <= endMinutes) {
    const slotStart = minutesToTime(currentStart);
    const slotEnd = minutesToTime(currentStart + slotCapacityMinutes);
    slots.push({ start_time: slotStart, end_time: slotEnd });
    currentStart += 60;
  }

  const remainingMinutes = endMinutes - currentStart;
  if (remainingMinutes >= 60) {
    const slotStart = minutesToTime(currentStart);
    const slotEnd = minutesToTime(endMinutes);
    slots.push({ start_time: slotStart, end_time: slotEnd });
  }

  return slots;
}

async function countTicketsForSlot(
  app: FastifyInstance,
  date: string,
  slotStart: string,
): Promise<number> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM tickets 
     WHERE reservation_date = $1 
     AND status IN ('pending', 'paid', 'used')
     AND slot_start_time = $2`,
    [date, slotStart]
  );

  return parseInt(result.rows[0].count, 10);
}

async function getScheduleForDate(
  app: FastifyInstance,
  date: string
): Promise<Schedule | null> {
  const schedules = await getPublicSchedules(app, { date });

  if (schedules.length === 0) {
    return null;
  }

  const exceptions = schedules.filter(s => s.is_exception && !s.is_closed);
  if (exceptions.length > 0) {
    return exceptions[0];
  }

  const regularSchedules = schedules.filter(s => !s.is_exception && !s.is_closed);
  if (regularSchedules.length > 0) {
    return regularSchedules[0];
  }

  return null;
}

export async function getSlotsForDate(
  app: FastifyInstance,
  date: string
): Promise<GetSlotsResponse> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new Error('Format de date invalide. Format attendu: YYYY-MM-DD');
  }

  const schedule = await getScheduleForDate(app, date);

  if (!schedule) {
    return {
      date,
      slots: [],
      total_capacity: 0,
      total_booked: 0,
      total_available: 0,
    };
  }

  if (schedule.is_closed) {
    return {
      date,
      slots: [],
      total_capacity: 0,
      total_booked: 0,
      total_available: 0,
    };
  }

  const slotCapacityHours = (await getSettingValue<number>(app, 'slot_capacity', 1)) || 1;
  const dailyCapacity = (await getSettingValue<number>(app, 'capacity', 100)) || 100;

  const slotRanges = generateSlotsForSchedule(
    schedule.start_time,
    schedule.end_time,
    slotCapacityHours
  );

  const slots: Slot[] = [];

  const uniqueTicketsResult = await app.pg.query<{ count: string }>(
    `SELECT COUNT(DISTINCT id) as count
     FROM tickets 
     WHERE reservation_date = $1 
     AND status IN ('pending', 'paid', 'used')`,
    [date]
  );
  const totalUniqueBooked = parseInt(uniqueTicketsResult.rows[0].count, 10);

  for (const slotRange of slotRanges) {
    const booked = await countTicketsForSlot(
      app,
      date,
      slotRange.start_time,
    );

    const available = Math.max(0, dailyCapacity - booked);
    const occupancyPercentage = dailyCapacity > 0
      ? Math.round((booked / dailyCapacity) * 100)
      : 0;

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

