import type { FastifyInstance } from 'fastify';
import type {
  Schedule,
  CreateScheduleBody,
  UpdateScheduleBody,
  GetSchedulesQuery,
  ReorderSchedulesBody,
  PublicSchedule,
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

  // Si position n'est pas fournie, on l'assigne automatiquement à la fin
  let position = data.position;
  if (position === undefined) {
    const maxPositionResult = await app.pg.query<{ max_position: number | null }>(
      'SELECT MAX(position) as max_position FROM schedules'
    );
    position = (maxPositionResult.rows[0]?.max_position ?? 0) + 1;
  }

  const result = await app.pg.query<Schedule>(
    `INSERT INTO schedules (
      day_of_week, start_time, end_time, audience_type,
      start_date, end_date, is_exception, is_closed, description, position
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      position,
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

    if (data.position !== undefined) {
      updates.push(`position = $${paramIndex}`);
      params.push(data.position);
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

  sql += ' ORDER BY position ASC, is_exception ASC, day_of_week ASC, start_time ASC';

  const result = await app.pg.query<Schedule>(sql, params);
  return result.rows;
}

/**
 * Récupère uniquement les horaires publics (pour le site public)
 * Inclut toujours les horaires 'holiday' avec les informations des périodes de vacances
 */
export async function getPublicSchedules(
  app: FastifyInstance,
  query: Omit<GetSchedulesQuery, 'audience_type'> = {}
): Promise<PublicSchedule[]> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Récupérer toutes les périodes spéciales actives (vacances et fermetures)
  let holidayPeriods: Array<{ id: string; name: string | null; start_date: string; end_date: string; zone: string | null }> = [];
  let closurePeriods: Array<{ id: string; name: string | null; start_date: string; end_date: string; zone: string | null }> = [];
  try {
    const { getSpecialPeriods } = await import('../special-periods/special-periods.service.ts');
    const allPeriods = await getSpecialPeriods(app, { is_active: true });

    holidayPeriods = allPeriods
      .filter(p => p.type === 'holiday')
      .map(p => ({
        id: p.id,
        name: p.name,
        start_date: p.start_date,
        end_date: p.end_date,
        zone: p.zone,
      }));

    closurePeriods = allPeriods
      .filter(p => p.type === 'closure')
      .map(p => ({
        id: p.id,
        name: p.name,
        start_date: p.start_date,
        end_date: p.end_date,
        zone: p.zone,
      }));
  } catch (err) {
    app.log.warn({ err }, 'Erreur lors de la récupération des périodes spéciales');
  }

  // Vérifier si on est dans une période de vacances (pour la logique de filtrage)
  let isHoliday = false;
  if (query.date) {
    try {
      const { isHolidayPeriod } = await import('../special-periods/special-periods.service.ts');
      isHoliday = await isHolidayPeriod(app, query.date);
    } catch (err) {
      app.log.warn({ err, date: query.date }, 'Erreur lors de la vérification des vacances');
    }
  }

  // Vérifier si on est dans une période de fermeture
  let isClosed = false;
  if (query.date) {
    const { isClosurePeriod } = await import('../special-periods/special-periods.service.ts');
    try {
      isClosed = await isClosurePeriod(app, query.date);
    } catch (err) {
      app.log.warn({ err, date: query.date }, 'Erreur lors de la vérification des fermetures');
    }
  }

  // Si on est en fermeture, retourner uniquement les horaires avec is_closed = true
  if (isClosed) {
    let sql = `SELECT * FROM schedules WHERE is_closed = true`;
    const params: any[] = [];
    let paramIndex = 1;

    if (query.day_of_week !== undefined) {
      sql += ` AND day_of_week = $${paramIndex}`;
      params.push(query.day_of_week);
      paramIndex++;
    }

    if (query.date) {
      const dateObj = new Date(query.date);
      const dayOfWeek = dateObj.getDay();
      sql += ` AND (
        (is_exception = false AND day_of_week = $${paramIndex})
        OR
        (is_exception = true AND start_date <= $${paramIndex + 1} AND end_date >= $${paramIndex + 1})
      )`;
      params.push(dayOfWeek, query.date);
      paramIndex += 2;
    }

    sql += ' ORDER BY position ASC, is_exception ASC, day_of_week ASC, start_time ASC';
    const result = await app.pg.query<Schedule>(sql, params);

    // Enrichir les horaires de fermeture avec les périodes de fermeture
    const enrichedClosureSchedules: PublicSchedule[] = result.rows.map(schedule => {
      // Trouver toutes les périodes de fermeture qui correspondent
      const matchingClosurePeriods = closurePeriods.filter(period => {
        if (schedule.start_date && schedule.end_date) {
          return period.start_date <= schedule.end_date && period.end_date >= schedule.start_date;
        }
        return true;
      });

      return {
        ...schedule,
        holiday_periods: [],
        closure_periods: matchingClosurePeriods,
      };
    });

    // Si aucun horaire de fermeture n'est défini, retourner un horaire virtuel avec les périodes de fermeture
    if (enrichedClosureSchedules.length === 0) {
      const matchingClosurePeriods = closurePeriods.filter(period => {
        if (query.date) {
          return period.start_date <= query.date && period.end_date >= query.date;
        }
        return true;
      });

      return [{
        id: 'closure',
        day_of_week: null,
        start_time: '00:00:00',
        end_time: '00:00:00',
        audience_type: 'public',
        start_date: null,
        end_date: null,
        is_exception: true,
        is_closed: true,
        description: 'Fermeture exceptionnelle',
        position: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        holiday_periods: [],
        closure_periods: matchingClosurePeriods,
      } as PublicSchedule];
    }

    return enrichedClosureSchedules;
  }

  // Toujours inclure les horaires 'public' ET 'holiday' pour que le frontend puisse les afficher
  // Le frontend décidera quand afficher les horaires holiday selon les périodes de vacances
  const audienceTypes = ['public', 'holiday'];

  let sql = `SELECT * FROM schedules WHERE audience_type = ANY($1::audience_type[])`;
  const params: any[] = [audienceTypes];
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

  sql += ' ORDER BY position ASC, is_exception ASC, day_of_week ASC, start_time ASC';

  const result = await app.pg.query<Schedule>(sql, params);
  const schedules = result.rows;

  // Enrichir les horaires avec les informations des périodes spéciales
  const enrichedSchedules: PublicSchedule[] = schedules.map(schedule => {
    // Trouver toutes les périodes de vacances qui correspondent à cet horaire
    const matchingHolidayPeriods = holidayPeriods.filter(period => {
      // Si l'horaire a des dates spécifiques, vérifier le chevauchement
      if (schedule.start_date && schedule.end_date) {
        return period.start_date <= schedule.end_date && period.end_date >= schedule.start_date;
      }
      // Si l'horaire est récurrent (pas de dates), on associe toutes les périodes actives
      // Le frontend décidera quand afficher cet horaire
      return true;
    });

    // Trouver toutes les périodes de fermeture qui correspondent à cet horaire
    const matchingClosurePeriods = closurePeriods.filter(period => {
      // Si l'horaire a des dates spécifiques, vérifier le chevauchement
      if (schedule.start_date && schedule.end_date) {
        return period.start_date <= schedule.end_date && period.end_date >= schedule.start_date;
      }
      // Si l'horaire est récurrent, on associe toutes les périodes de fermeture
      return true;
    });

    return {
      ...schedule,
      holiday_periods: matchingHolidayPeriods,
      closure_periods: matchingClosurePeriods,
    };
  });

  return enrichedSchedules;
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

  if (data.position !== undefined) {
    updates.push(`position = $${paramIndex}`);
    params.push(data.position);
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

/**
 * Réordonne les horaires selon l'ordre fourni
 * Met à jour les positions de tous les horaires selon l'ordre des IDs fournis
 */
export async function reorderSchedules(
  app: FastifyInstance,
  data: ReorderSchedulesBody
): Promise<Schedule[]> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  if (!data.schedule_ids || data.schedule_ids.length === 0) {
    throw new Error('Le tableau schedule_ids ne peut pas être vide');
  }

  // Vérifier que tous les IDs existent
  const placeholders = data.schedule_ids.map((_, i) => `$${i + 1}`).join(', ');
  const existingSchedules = await app.pg.query<Schedule>(
    `SELECT id FROM schedules WHERE id IN (${placeholders})`,
    data.schedule_ids
  );

  if (existingSchedules.rows.length !== data.schedule_ids.length) {
    throw new Error('Un ou plusieurs IDs d\'horaires sont invalides');
  }

  // Mettre à jour les positions dans une transaction
  try {
    await app.pg.query('BEGIN');

    // Mettre à jour chaque horaire avec sa nouvelle position
    for (let i = 0; i < data.schedule_ids.length; i++) {
      const scheduleId = data.schedule_ids[i];
      const newPosition = i + 1; // Position commence à 1

      await app.pg.query(
        'UPDATE schedules SET position = $1, updated_at = current_timestamp WHERE id = $2',
        [newPosition, scheduleId]
      );
    }

    await app.pg.query('COMMIT');

    // Récupérer tous les horaires mis à jour dans l'ordre
    const result = await app.pg.query<Schedule>(
      `SELECT * FROM schedules WHERE id IN (${placeholders}) ORDER BY position ASC`,
      data.schedule_ids
    );

    return result.rows;
  } catch (err) {
    await app.pg.query('ROLLBACK');
    throw err;
  }
}

