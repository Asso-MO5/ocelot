import type { FastifyInstance } from 'fastify';
import type {
  Event,
  CreateEventBody,
  UpdateEventBody,
  GetEventsQuery,
  PaginatedEventsResponse,
  CalendarDay,
  CalendarResponse,
  GetCalendarQuery,
  EventStatus,
} from './events.types.ts';
export async function createEvent(
  app: FastifyInstance,
  data: CreateEventBody
): Promise<Event> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  if (data.end_date) {
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    if (endDate < startDate) {
      throw new Error('La date de fin doit être supérieure ou égale à la date de début');
    }
  }

  if (data.type === 'museum' && !data.category) {
    throw new Error('La catégorie est requise pour les événements du musée');
  }

  const result = await app.pg.query<Event>(
    `INSERT INTO events (
      type, category, status, start_date, end_date, start_time, end_time,
      location_type, location_name, location_address, location_city, location_postal_code,
      public_title_fr, public_title_en, public_description_fr, public_description_en,
      public_image_url, private_notes, private_contact,
      manager_dev, manager_bureau, manager_museum, manager_com,
      capacity, is_active
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
    )
    RETURNING *`,
    [
      data.type,
      data.category ?? null,
      data.status ?? 'draft',
      data.start_date,
      data.end_date ?? null,
      data.start_time ?? null,
      data.end_time ?? null,
      data.location_type ?? 'museum',
      data.location_name ?? null,
      data.location_address ?? null,
      data.location_city ?? null,
      data.location_postal_code ?? null,
      data.public_title_fr ?? null,
      data.public_title_en ?? null,
      data.public_description_fr ?? null,
      data.public_description_en ?? null,
      data.public_image_url ?? null,
      data.private_notes ?? null,
      data.private_contact ?? null,
      data.manager_dev ?? false,
      data.manager_bureau ?? false,
      data.manager_museum ?? false,
      data.manager_com ?? false,
      data.capacity ?? null,
      data.is_active ?? true,
    ]
  );

  const event = result.rows[0];

  if (data.related_event_ids && data.related_event_ids.length > 0) {
    await linkEvents(app, event.id, data.related_event_ids);
  }

  return event;
}

async function linkEvents(
  app: FastifyInstance,
  parentEventId: string,
  childEventIds: string[]
): Promise<void> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  for (const childId of childEventIds) {
    if (childId === parentEventId) {
      throw new Error('Un événement ne peut pas être lié à lui-même');
    }

    const childResult = await app.pg.query('SELECT id FROM events WHERE id = $1', [childId]);
    if (childResult.rows.length === 0) {
      throw new Error(`Événement ${childId} non trouvé`);
    }
  }

  for (const childId of childEventIds) {
    try {
      await app.pg.query(
        `INSERT INTO event_relations (parent_event_id, child_event_id, relation_type)
         VALUES ($1, $2, 'related')
         ON CONFLICT (parent_event_id, child_event_id, relation_type) DO NOTHING`,
        [parentEventId, childId]
      );
    } catch (err) {
      app.log.warn({ err, parentEventId, childId }, 'Erreur lors de la création de la relation');
    }
  }
}

export async function getEvents(
  app: FastifyInstance,
  query: GetEventsQuery = {}
): Promise<PaginatedEventsResponse> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM events WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM events WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (query.type) {
    sql += ` AND type = $${paramIndex}`;
    countSql += ` AND type = $${paramIndex}`;
    params.push(query.type);
    paramIndex++;
  }

  if (query.category) {
    sql += ` AND category = $${paramIndex}`;
    countSql += ` AND category = $${paramIndex}`;
    params.push(query.category);
    paramIndex++;
  }

  if (query.status) {
    sql += ` AND status = $${paramIndex}`;
    countSql += ` AND status = $${paramIndex}`;
    params.push(query.status);
    paramIndex++;
  }

  if (query.start_date) {
    sql += ` AND (end_date IS NULL OR end_date >= $${paramIndex})`;
    countSql += ` AND (end_date IS NULL OR end_date >= $${paramIndex})`;
    params.push(query.start_date);
    paramIndex++;
  }

  if (query.end_date) {
    sql += ` AND start_date <= $${paramIndex}`;
    countSql += ` AND start_date <= $${paramIndex}`;
    params.push(query.end_date);
    paramIndex++;
  }

  if (query.date) {
    // Événements qui incluent cette date
    sql += ` AND start_date <= $${paramIndex} AND (end_date IS NULL OR end_date >= $${paramIndex})`;
    countSql += ` AND start_date <= $${paramIndex} AND (end_date IS NULL OR end_date >= $${paramIndex})`;
    params.push(query.date);
    paramIndex++;
  }

  if (query.location_type) {
    sql += ` AND location_type = $${paramIndex}`;
    countSql += ` AND location_type = $${paramIndex}`;
    params.push(query.location_type);
    paramIndex++;
  }

  if (query.is_active !== undefined) {
    sql += ` AND is_active = $${paramIndex}`;
    countSql += ` AND is_active = $${paramIndex}`;
    params.push(query.is_active);
    paramIndex++;
  }

  // Compter le total
  const countResult = await app.pg.query<{ total: string }>(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  sql += ' ORDER BY start_date ASC, start_time ASC NULLS LAST LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1);
  params.push(limit, offset);

  const result = await app.pg.query<Event>(sql, params);
  let events = result.rows;

  if (query.include_relations) {
    events = await enrichEventsWithRelations(app, events);
  }

  return {
    events,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

async function enrichEventsWithRelations(
  app: FastifyInstance,
  events: Event[]
): Promise<Event[]> {
  if (!app.pg || events.length === 0) {
    return events;
  }

  const eventIds = events.map(e => e.id);

  const relationsResult = await app.pg.query<{
    parent_event_id: string;
    child_event_id: string;
    relation_type: string;
  }>(
    `SELECT parent_event_id, child_event_id, relation_type
     FROM event_relations
     WHERE parent_event_id = ANY($1::uuid[]) OR child_event_id = ANY($1::uuid[])`,
    [eventIds]
  );

  const relatedEventIds = new Set<string>();
  relationsResult.rows.forEach(r => {
    relatedEventIds.add(r.parent_event_id);
    relatedEventIds.add(r.child_event_id);
  });

  let relatedEvents: Event[] = [];
  if (relatedEventIds.size > 0) {
    const relatedIdsArray = Array.from(relatedEventIds);
    const relatedResult = await app.pg.query<Event>(
      `SELECT * FROM events WHERE id = ANY($1::uuid[])`,
      [relatedIdsArray]
    );
    relatedEvents = relatedResult.rows;
  }

  const relatedEventsMap = new Map<string, Event[]>();
  const parentEventsMap = new Map<string, Event[]>();

  relationsResult.rows.forEach(rel => {
    const relatedEvent = relatedEvents.find(e => e.id === rel.child_event_id);
    const parentEvent = relatedEvents.find(e => e.id === rel.parent_event_id);

    if (relatedEvent && eventIds.includes(rel.parent_event_id)) {
      if (!relatedEventsMap.has(rel.parent_event_id)) {
        relatedEventsMap.set(rel.parent_event_id, []);
      }
      relatedEventsMap.get(rel.parent_event_id)!.push(relatedEvent);
    }

    if (parentEvent && eventIds.includes(rel.child_event_id)) {
      if (!parentEventsMap.has(rel.child_event_id)) {
        parentEventsMap.set(rel.child_event_id, []);
      }
      parentEventsMap.get(rel.child_event_id)!.push(parentEvent);
    }
  });

  // Enrichir les événements
  return events.map(event => ({
    ...event,
    related_events: relatedEventsMap.get(event.id) ?? [],
    parent_events: parentEventsMap.get(event.id) ?? [],
  }));
}

export async function getEventById(
  app: FastifyInstance,
  id: string,
  includeRelations = false
): Promise<Event | null> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<Event>(
    'SELECT * FROM events WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  let event = result.rows[0];

  if (includeRelations) {
    const enriched = await enrichEventsWithRelations(app, [event]);
    event = enriched[0];
  }

  return event;
}

export async function updateEvent(
  app: FastifyInstance,
  id: string,
  data: UpdateEventBody
): Promise<Event> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const existing = await getEventById(app, id);
  if (!existing) {
    throw new Error('Événement non trouvé');
  }

  const startDate = data.start_date ? new Date(data.start_date) : new Date(existing.start_date);
  const endDate = data.end_date !== undefined
    ? (data.end_date ? new Date(data.end_date) : null)
    : (existing.end_date ? new Date(existing.end_date) : null);

  if (endDate && endDate < startDate) {
    throw new Error('La date de fin doit être supérieure ou égale à la date de début');
  }

  // Validation : category requis pour les événements museum
  const type = data.type ?? existing.type;
  const category = data.category !== undefined ? data.category : existing.category;
  if (type === 'museum' && !category) {
    throw new Error('La catégorie est requise pour les événements du musée');
  }

  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.type !== undefined) {
    updates.push(`type = $${paramIndex}`);
    params.push(data.type);
    paramIndex++;
  }

  if (data.category !== undefined) {
    updates.push(`category = $${paramIndex}`);
    params.push(data.category);
    paramIndex++;
  }

  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex}`);
    params.push(data.status);
    paramIndex++;
  }

  if (data.start_date !== undefined) {
    updates.push(`start_date = $${paramIndex}`);
    params.push(data.start_date);
    paramIndex++;
  }

  if (data.end_date !== undefined) {
    updates.push(`end_date = $${paramIndex}`);
    params.push(data.end_date);
    paramIndex++;
  }

  if (data.start_time !== undefined) {
    updates.push(`start_time = $${paramIndex}`);
    params.push(data.start_time);
    paramIndex++;
  }

  if (data.end_time !== undefined) {
    updates.push(`end_time = $${paramIndex}`);
    params.push(data.end_time);
    paramIndex++;
  }

  if (data.location_type !== undefined) {
    updates.push(`location_type = $${paramIndex}`);
    params.push(data.location_type);
    paramIndex++;
  }

  if (data.location_name !== undefined) {
    updates.push(`location_name = $${paramIndex}`);
    params.push(data.location_name);
    paramIndex++;
  }

  if (data.location_address !== undefined) {
    updates.push(`location_address = $${paramIndex}`);
    params.push(data.location_address);
    paramIndex++;
  }

  if (data.location_city !== undefined) {
    updates.push(`location_city = $${paramIndex}`);
    params.push(data.location_city);
    paramIndex++;
  }

  if (data.location_postal_code !== undefined) {
    updates.push(`location_postal_code = $${paramIndex}`);
    params.push(data.location_postal_code);
    paramIndex++;
  }

  if (data.public_title_fr !== undefined) {
    updates.push(`public_title_fr = $${paramIndex}`);
    params.push(data.public_title_fr);
    paramIndex++;
  }

  if (data.public_title_en !== undefined) {
    updates.push(`public_title_en = $${paramIndex}`);
    params.push(data.public_title_en);
    paramIndex++;
  }

  if (data.public_description_fr !== undefined) {
    updates.push(`public_description_fr = $${paramIndex}`);
    params.push(data.public_description_fr);
    paramIndex++;
  }

  if (data.public_description_en !== undefined) {
    updates.push(`public_description_en = $${paramIndex}`);
    params.push(data.public_description_en);
    paramIndex++;
  }

  if (data.public_image_url !== undefined) {
    updates.push(`public_image_url = $${paramIndex}`);
    params.push(data.public_image_url);
    paramIndex++;
  }

  if (data.private_notes !== undefined) {
    updates.push(`private_notes = $${paramIndex}`);
    params.push(data.private_notes);
    paramIndex++;
  }

  if (data.private_contact !== undefined) {
    updates.push(`private_contact = $${paramIndex}`);
    params.push(data.private_contact);
    paramIndex++;
  }

  if (data.manager_dev !== undefined) {
    updates.push(`manager_dev = $${paramIndex}`);
    params.push(data.manager_dev);
    paramIndex++;
  }

  if (data.manager_bureau !== undefined) {
    updates.push(`manager_bureau = $${paramIndex}`);
    params.push(data.manager_bureau);
    paramIndex++;
  }

  if (data.manager_museum !== undefined) {
    updates.push(`manager_museum = $${paramIndex}`);
    params.push(data.manager_museum);
    paramIndex++;
  }

  if (data.manager_com !== undefined) {
    updates.push(`manager_com = $${paramIndex}`);
    params.push(data.manager_com);
    paramIndex++;
  }

  if (data.capacity !== undefined) {
    updates.push(`capacity = $${paramIndex}`);
    params.push(data.capacity);
    paramIndex++;
  }

  if (data.is_active !== undefined) {
    updates.push(`is_active = $${paramIndex}`);
    params.push(data.is_active);
    paramIndex++;
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push(`updated_at = current_timestamp`);
  params.push(id);

  const result = await app.pg.query<Event>(
    `UPDATE events
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    params
  );

  const updatedEvent = result.rows[0];

  if (data.related_event_ids !== undefined) {
    await app.pg.query(
      'DELETE FROM event_relations WHERE parent_event_id = $1 OR child_event_id = $1',
      [id]
    );

    if (data.related_event_ids.length > 0) {
      await linkEvents(app, id, data.related_event_ids);
    }
  }

  return updatedEvent;
}

/**
 * Supprime un événement
 */
export async function deleteEvent(
  app: FastifyInstance,
  id: string
): Promise<boolean> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Les relations seront supprimées automatiquement grâce à CASCADE
  const result = await app.pg.query(
    'DELETE FROM events WHERE id = $1',
    [id]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Récupère le calendrier avec événements et horaires
 */
export async function getCalendar(
  app: FastifyInstance,
  query: GetCalendarQuery
): Promise<CalendarResponse> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const startDate = new Date(query.start_date);
  const endDate = query.end_date ? new Date(query.end_date) : new Date(query.start_date);
  const view = query.view ?? 'month';

  let actualStartDate: Date;
  let actualEndDate: Date;

  switch (view) {
    case 'day':
      actualStartDate = new Date(startDate);
      actualEndDate = new Date(startDate);
      break;
    case 'week':
      // Semaine commençant le lundi
      const dayOfWeek = startDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      actualStartDate = new Date(startDate);
      actualStartDate.setDate(startDate.getDate() + mondayOffset);
      actualEndDate = new Date(actualStartDate);
      actualEndDate.setDate(actualStartDate.getDate() + 6);
      break;
    case 'month':
      actualStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      actualEndDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      break;
    default:
      actualStartDate = new Date(startDate);
      actualEndDate = new Date(endDate);
  }

  const days: CalendarDay[] = [];
  const currentDate = new Date(actualStartDate);

  while (currentDate <= actualEndDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    days.push({
      date: dateStr,
      is_open: false,
      opening_hours: [],
      paid_tickets_count: 0,
      events: [],
      holiday_periods: [],
      closure_periods: [],
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const ticketsCountResult = await app.pg.query<{
    reservation_date: string;
    count: string;
  }>(
    `SELECT reservation_date::text, COUNT(*)::int AS count
     FROM tickets
     WHERE status = 'paid'
       AND reservation_date BETWEEN $1 AND $2
     GROUP BY reservation_date`,
    [
      actualStartDate.toISOString().split('T')[0],
      actualEndDate.toISOString().split('T')[0],
    ]
  );
  const paidTicketsByDate = new Map<string, number>();
  for (const row of ticketsCountResult.rows) {
    paidTicketsByDate.set(row.reservation_date, parseInt(row.count, 10));
  }

  const { getPublicSchedules } = await import('../schedules/schedules.service.ts');
  const dateStrings = days.map(d => d.date);

  const { getSpecialPeriods } = await import('../special-periods/special-periods.service.ts');
  const allPeriods = await getSpecialPeriods(app, { is_active: true });

  const statusFilter = query.include_private
    ? undefined
    : (query.status ? [query.status] : ['public', 'member']);

  const eventTypes = query.event_types ?? ['museum', 'association', 'external'];

  // Récupérer les événements pour chaque type (car getEvents ne supporte qu'un seul type à la fois)
  let allEvents: Event[] = [];
  for (const eventType of eventTypes) {
    const eventsResult = await getEvents(app, {
      type: eventType,
      start_date: actualStartDate.toISOString().split('T')[0],
      end_date: actualEndDate.toISOString().split('T')[0],
      status: statusFilter?.[0] as EventStatus | undefined,
      is_active: true,
    });
    allEvents.push(...eventsResult.events);
  }

  // Dédupliquer les événements (au cas où un événement serait retourné plusieurs fois)
  const uniqueEvents = new Map<string, Event>();
  for (const event of allEvents) {
    uniqueEvents.set(event.id, event);
  }
  let events = Array.from(uniqueEvents.values());

  // Filtrer les événements par statut si nécessaire (double vérification)
  if (statusFilter && statusFilter.length > 0) {
    events = events.filter(e => statusFilter.includes(e.status));
  }

  // Enrichir chaque jour
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const dateObj = new Date(day.date);
    const dayOfWeek = dateObj.getDay();

    // Récupérer les horaires pour ce jour
    const schedules = await getPublicSchedules(app, {
      day_of_week: dayOfWeek,
      date: day.date,
      include_exceptions: true,
    });

    const hasOpenSchedule = schedules.some(s => !s.is_closed);
    day.is_open = hasOpenSchedule;

    day.opening_hours = schedules
      .filter(s => !s.is_closed)
      .map(s => ({
        start_time: s.start_time,
        end_time: s.end_time,
        audience_type: s.audience_type,
        description: s.description,
      }));

    day.holiday_periods = allPeriods
      .filter(p => p.type === 'holiday' && p.start_date <= day.date && p.end_date >= day.date)
      .map(p => ({
        id: p.id,
        name: p.name,
        start_date: p.start_date,
        end_date: p.end_date,
        zone: p.zone,
      }));

    day.closure_periods = allPeriods
      .filter(p => p.type === 'closure' && p.start_date <= day.date && p.end_date >= day.date)
      .map(p => ({
        id: p.id,
        name: p.name,
        start_date: p.start_date,
        end_date: p.end_date,
        zone: p.zone,
      }));

    day.paid_tickets_count = paidTicketsByDate.get(day.date) ?? 0;

    day.events = events.filter(e => {
      const eventStart = new Date(e.start_date);
      const eventEnd = e.end_date ? new Date(e.end_date) : new Date(e.start_date);
      const dayDate = new Date(day.date);
      return dayDate >= eventStart && dayDate <= eventEnd;
    });
  }

  return {
    days,
    start_date: actualStartDate.toISOString().split('T')[0],
    end_date: actualEndDate.toISOString().split('T')[0],
    view,
  };
}

