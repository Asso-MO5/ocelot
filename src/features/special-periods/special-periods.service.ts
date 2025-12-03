import type { FastifyInstance } from 'fastify';
import type {
  SpecialPeriod,
  CreateSpecialPeriodBody,
  UpdateSpecialPeriodBody,
  GetSpecialPeriodsQuery,
} from './special-periods.types.ts';

/**
 * Crée une période spéciale
 */
export async function createSpecialPeriod(
  app: FastifyInstance,
  data: CreateSpecialPeriodBody
): Promise<SpecialPeriod> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Validation : end_date doit être >= start_date
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  if (endDate < startDate) {
    throw new Error('La date de fin doit être supérieure ou égale à la date de début');
  }

  const result = await app.pg.query<SpecialPeriod>(
    `INSERT INTO special_periods (
      type, start_date, end_date, name, description, zone, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      data.type,
      data.start_date,
      data.end_date,
      data.name ?? null,
      data.description ?? null,
      data.zone ?? null,
      data.is_active ?? true,
    ]
  );

  return result.rows[0];
}

/**
 * Récupère toutes les périodes spéciales avec filtres optionnels
 */
export async function getSpecialPeriods(
  app: FastifyInstance,
  query: GetSpecialPeriodsQuery = {}
): Promise<SpecialPeriod[]> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  let sql = 'SELECT * FROM special_periods WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (query.type) {
    sql += ` AND type = $${paramIndex}`;
    params.push(query.type);
    paramIndex++;
  }

  if (query.date) {
    // Vérifier si la date est dans une période
    sql += ` AND start_date <= $${paramIndex} AND end_date >= $${paramIndex}`;
    params.push(query.date);
    paramIndex++;
  }

  if (query.zone) {
    sql += ` AND (zone = $${paramIndex} OR zone = 'all' OR zone IS NULL)`;
    params.push(query.zone);
    paramIndex++;
  }

  if (query.is_active !== undefined) {
    sql += ` AND is_active = $${paramIndex}`;
    params.push(query.is_active);
    paramIndex++;
  }

  sql += ' ORDER BY start_date DESC, end_date DESC';

  const result = await app.pg.query<SpecialPeriod>(sql, params);
  return result.rows;
}

/**
 * Vérifie si une date est dans une période de vacances
 */
export async function isHolidayPeriod(
  app: FastifyInstance,
  date: string,
  zone?: string
): Promise<boolean> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  let sql = `
    SELECT COUNT(*) as count
    FROM special_periods
    WHERE type = 'holiday'
      AND is_active = true
      AND start_date <= $1
      AND end_date >= $1
  `;
  const params: any[] = [date];

  if (zone) {
    sql += ` AND (zone = $2 OR zone = 'all' OR zone IS NULL)`;
    params.push(zone);
  }

  const result = await app.pg.query<{ count: string }>(sql, params);
  return parseInt(result.rows[0].count, 10) > 0;
}

/**
 * Vérifie si une date est dans une période de fermeture
 */
export async function isClosurePeriod(
  app: FastifyInstance,
  date: string
): Promise<boolean> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<{ count: string }>(
    `
    SELECT COUNT(*) as count
    FROM special_periods
    WHERE type = 'closure'
      AND is_active = true
      AND start_date <= $1
      AND end_date >= $1
    `,
    [date]
  );

  return parseInt(result.rows[0].count, 10) > 0;
}

/**
 * Récupère une période spéciale par son ID
 */
export async function getSpecialPeriodById(
  app: FastifyInstance,
  id: string
): Promise<SpecialPeriod | null> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<SpecialPeriod>(
    'SELECT * FROM special_periods WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Met à jour une période spéciale
 */
export async function updateSpecialPeriod(
  app: FastifyInstance,
  id: string,
  data: UpdateSpecialPeriodBody
): Promise<SpecialPeriod> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Vérifier que la période existe
  const existing = await getSpecialPeriodById(app, id);
  if (!existing) {
    throw new Error('Période spéciale non trouvée');
  }

  // Validation des dates si fournies
  const startDate = data.start_date ? new Date(data.start_date) : new Date(existing.start_date);
  const endDate = data.end_date ? new Date(data.end_date) : new Date(existing.end_date);
  if (endDate < startDate) {
    throw new Error('La date de fin doit être supérieure ou égale à la date de début');
  }

  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.type !== undefined) {
    updates.push(`type = $${paramIndex}`);
    params.push(data.type);
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

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex}`);
    params.push(data.name);
    paramIndex++;
  }

  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex}`);
    params.push(data.description);
    paramIndex++;
  }

  if (data.zone !== undefined) {
    updates.push(`zone = $${paramIndex}`);
    params.push(data.zone);
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

  const result = await app.pg.query<SpecialPeriod>(
    `UPDATE special_periods
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    params
  );

  return result.rows[0];
}

/**
 * Supprime une période spéciale
 */
export async function deleteSpecialPeriod(
  app: FastifyInstance,
  id: string
): Promise<boolean> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query(
    'DELETE FROM special_periods WHERE id = $1',
    [id]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

