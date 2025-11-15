import type { FastifyInstance } from 'fastify';
import type {
  Schedule,
  CreateScheduleBody,
  UpdateScheduleBody,
  GetSchedulesQuery,
} from './schedules.types.ts';

/**
 * Crée un nouvel horaire
 */
export async function createSchedule(
  app: FastifyInstance,
  data: CreateScheduleBody
): Promise<Schedule> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Validation : si is_exception est false, day_of_week doit être défini
  if (!data.is_exception && data.day_of_week === undefined) {
    throw new Error('day_of_week est requis pour les horaires récurrents');
  }

  // Validation : si is_exception est true, start_date et end_date doivent être définis
  if (data.is_exception && (!data.start_date || !data.end_date)) {
    throw new Error('start_date et end_date sont requis pour les exceptions');
  }

  const result = await app.pg.query<Schedule>(
    `INSERT INTO schedules (
      day_of_week, start_time, end_time, audience_type,
      start_date, end_date, is_exception, is_closed, description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      data.day_of_week ?? null,
      data.start_time,
      data.end_time,
      data.audience_type,
      data.start_date ?? null,
      data.end_date ?? null,
      data.is_exception ?? false,
      data.is_closed ?? false,
      data.description ?? null,
    ]
  );

  return result.rows[0];
}

/**
 * Crée ou met à jour un horaire (UPSERT)
 * - Pour les exceptions : cherche par start_date, end_date et audience_type
 * - Pour les horaires récurrents : cherche par day_of_week et audience_type
 */
export async function upsertSchedule(
  app: FastifyInstance,
  data: CreateScheduleBody
): Promise<{ schedule: Schedule; created: boolean }> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Validation : si is_exception est false, day_of_week doit être défini
  if (!data.is_exception && data.day_of_week === undefined) {
    throw new Error('day_of_week est requis pour les horaires récurrents');
  }

  // Validation : si is_exception est true, start_date et end_date doivent être définis
  if (data.is_exception && (!data.start_date || !data.end_date)) {
    throw new Error('start_date et end_date sont requis pour les exceptions');
  }

  const isException = data.is_exception ?? false;

  // Chercher un horaire existant
  let existing: Schedule | null = null;

  if (isException) {
    // Pour les exceptions : chercher par start_date, end_date et audience_type
    const result = await app.pg.query<Schedule>(
      `SELECT * FROM schedules 
       WHERE is_exception = true 
       AND start_date = $1 
       AND end_date = $2 
       AND audience_type = $3
       LIMIT 1`,
      [data.start_date, data.end_date, data.audience_type]
    );
    existing = result.rows[0] || null;
  } else {
    // Pour les horaires récurrents : chercher par day_of_week et audience_type
    const result = await app.pg.query<Schedule>(
      `SELECT * FROM schedules 
       WHERE is_exception = false 
       AND day_of_week = $1 
       AND audience_type = $2
       LIMIT 1`,
      [data.day_of_week, data.audience_type]
    );
    existing = result.rows[0] || null;
  }

  if (existing) {
    // Mettre à jour l'horaire existant
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    updates.push(`start_time = $${paramIndex}`);
    params.push(data.start_time);
    paramIndex++;

    updates.push(`end_time = $${paramIndex}`);
    params.push(data.end_time);
    paramIndex++;

    if (data.is_closed !== undefined) {
      updates.push(`is_closed = $${paramIndex}`);
      params.push(data.is_closed);
      paramIndex++;
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(data.description);
      paramIndex++;
    }

    updates.push(`updated_at = current_timestamp`);
    params.push(existing.id);

    const result = await app.pg.query<Schedule>(
      `UPDATE schedules SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return { schedule: result.rows[0], created: false };
  } else {
    // Créer un nouvel horaire
    const schedule = await createSchedule(app, data);
    return { schedule, created: true };
  }
}

/**
 * Récupère tous les horaires avec filtres optionnels
 */
export async function getSchedules(
  app: FastifyInstance,
  query: GetSchedulesQuery = {}
): Promise<Schedule[]> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  let sql = 'SELECT * FROM schedules WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (query.day_of_week !== undefined) {
    sql += ` AND day_of_week = $${paramIndex}`;
    params.push(query.day_of_week);
    paramIndex++;
  }



  if (query.audience_type) {
    sql += ` AND audience_type = $${paramIndex}`;
    params.push(query.audience_type);
    paramIndex++;
  }

  if (query.date) {
    // Pour une date spécifique, on cherche :
    // 1. Les horaires récurrents pour le jour de la semaine de cette date
    // 2. Les exceptions qui couvrent cette date
    const dateObj = new Date(query.date);
    const dayOfWeek = dateObj.getDay(); // 0 = dimanche, 1 = lundi, etc.

    sql += ` AND (
      (is_exception = false AND day_of_week = $${paramIndex})
      OR
      (is_exception = true AND start_date <= $${paramIndex + 1} AND end_date >= $${paramIndex + 1})
    )`;
    params.push(dayOfWeek, query.date);
    paramIndex += 2;
  } else if (query.include_exceptions === false) {
    sql += ' AND is_exception = false';
  }

  sql += ' ORDER BY is_exception ASC, day_of_week ASC, start_time ASC';

  const result = await app.pg.query<Schedule>(sql, params);
  return result.rows;
}

/**
 * Récupère uniquement les horaires publics (pour le site public)
 */
export async function getPublicSchedules(
  app: FastifyInstance,
  query: Omit<GetSchedulesQuery, 'audience_type'> = {}
): Promise<Schedule[]> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  let sql = 'SELECT * FROM schedules WHERE audience_type = $1';
  const params: any[] = ['public'];
  let paramIndex = 2;

  if (query.day_of_week !== undefined) {
    sql += ` AND day_of_week = $${paramIndex}`;
    params.push(query.day_of_week);
    paramIndex++;
  }

  if (query.date) {
    // Pour une date spécifique, on cherche :
    // 1. Les horaires récurrents pour le jour de la semaine de cette date
    // 2. Les exceptions qui couvrent cette date
    const dateObj = new Date(query.date);
    const dayOfWeek = dateObj.getDay(); // 0 = dimanche, 1 = lundi, etc.
    sql += ` AND (
      (is_exception = false AND day_of_week = $${paramIndex})
      OR
      (is_exception = true AND start_date <= $${paramIndex + 1} AND end_date >= $${paramIndex + 1})
    )`;
    params.push(dayOfWeek, query.date);
    paramIndex += 2;
  } else if (query.include_exceptions === false) {
    sql += ' AND is_exception = false';
  }

  sql += ' ORDER BY is_exception ASC, day_of_week ASC, start_time ASC';

  const result = await app.pg.query<Schedule>(sql, params);
  return result.rows;
}

/**
 * Récupère un horaire par son ID
 */
export async function getScheduleById(
  app: FastifyInstance,
  id: string
): Promise<Schedule | null> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<Schedule>(
    'SELECT * FROM schedules WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Met à jour un horaire
 */
export async function updateSchedule(
  app: FastifyInstance,
  id: string,
  data: UpdateScheduleBody
): Promise<Schedule> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Vérifier que l'horaire existe
  const existing = await getScheduleById(app, id);
  if (!existing) {
    throw new Error('Horaire non trouvé');
  }

  // Construire la requête de mise à jour dynamiquement
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.day_of_week !== undefined) {
    updates.push(`day_of_week = $${paramIndex}`);
    params.push(data.day_of_week);
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

  if (data.audience_type !== undefined) {
    updates.push(`audience_type = $${paramIndex}`);
    params.push(data.audience_type);
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

  if (data.is_exception !== undefined) {
    updates.push(`is_exception = $${paramIndex}`);
    params.push(data.is_exception);
    paramIndex++;
  }

  if (data.is_closed !== undefined) {
    updates.push(`is_closed = $${paramIndex}`);
    params.push(data.is_closed);
    paramIndex++;
  }

  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex}`);
    params.push(data.description);
    paramIndex++;
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push(`updated_at = current_timestamp`);
  params.push(id);

  const result = await app.pg.query<Schedule>(
    `UPDATE schedules SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  return result.rows[0];
}

/**
 * Supprime un horaire
 */
export async function deleteSchedule(
  app: FastifyInstance,
  id: string
): Promise<boolean> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query(
    'DELETE FROM schedules WHERE id = $1',
    [id]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

