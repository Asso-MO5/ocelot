import type { FastifyInstance } from 'fastify';
import type {
  Price,
  CreatePriceBody,
  UpdatePriceBody,
  GetPricesQuery,
  Translation,
  ReorderPricesBody,
} from './prices.types.ts';

async function saveTranslations(
  app: FastifyInstance,
  entityType: string,
  entityId: string,
  translations: Translation[]
): Promise<void> {
  if (!app.pg || translations.length === 0) {
    return;
  }

  await app.pg.query(
    'DELETE FROM translations WHERE entity_type = $1 AND entity_id = $2',
    [entityType, entityId]
  );

  for (const translation of translations) {
    await app.pg.query(
      `INSERT INTO translations (entity_type, entity_id, field_name, lang, translation)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (entity_type, entity_id, field_name, lang)
       DO UPDATE SET translation = $5, updated_at = current_timestamp`,
      [
        entityType,
        entityId,
        translation.field_name,
        translation.lang,
        translation.translation,
      ]
    );
  }
}

async function getTranslations(
  app: FastifyInstance,
  entityType: string,
  entityId: string,
  lang?: string
): Promise<Record<string, Record<string, string>>> {
  if (!app.pg) {
    return {};
  }

  let sql = `
    SELECT field_name, lang, translation
    FROM translations
    WHERE entity_type = $1 AND entity_id = $2
  `;
  const params: any[] = [entityType, entityId];

  if (lang) {
    sql += ' AND lang = $3';
    params.push(lang);
  }

  sql += ' ORDER BY lang, field_name';

  const result = await app.pg.query<{ field_name: string; lang: string; translation: string }>(
    sql,
    params
  );

  const translations: Record<string, Record<string, string>> = {};
  for (const row of result.rows) {
    if (!translations[row.lang]) {
      translations[row.lang] = {};
    }
    translations[row.lang][row.field_name] = row.translation;
  }

  return translations;
}

async function enrichPriceWithTranslations(
  app: FastifyInstance,
  price: Price,
  lang?: string
): Promise<Price> {
  const translations = await getTranslations(app, 'price', price.id, lang);

  const enriched: Price = {
    ...price,
    translations: Object.keys(translations).length > 0 ? translations : undefined,
  };

  if (lang && translations[lang]) {
    enriched.name = translations[lang]['name'];
    enriched.description = translations[lang]['description'] || null;
  }

  return enriched;
}

export async function createPrice(
  app: FastifyInstance,
  data: CreatePriceBody
): Promise<{ price: Price; isUpdate: boolean }> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  if (data.amount < 0) {
    throw new Error('Le montant doit être positif ou nul');
  }

  if ((data.start_date && !data.end_date) || (!data.start_date && data.end_date)) {
    throw new Error('start_date et end_date doivent être définis ensemble ou laissés vides');
  }

  if (data.start_date && data.end_date) {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    if (start >= end) {
      throw new Error('start_date doit être antérieure à end_date');
    }
  }

  const nameTranslations = data.translations.filter(t => t.field_name === 'name');
  if (nameTranslations.length === 0) {
    throw new Error('Au moins une traduction pour le champ "name" est requise');
  }

  let price: Price;
  let isUpdate = false;

  if (data.id) {
    const existing = await app.pg.query<Price>(
      'SELECT * FROM prices WHERE id = $1',
      [data.id]
    );

    if (existing.rows[0]) {
      isUpdate = true;

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      updates.push(`amount = $${paramIndex}`);
      params.push(data.amount);
      paramIndex++;

      updates.push(`audience_type = $${paramIndex}`);
      params.push(data.audience_type);
      paramIndex++;

      updates.push(`start_date = $${paramIndex}`);
      params.push(data.start_date ?? null);
      paramIndex++;

      updates.push(`end_date = $${paramIndex}`);
      params.push(data.end_date ?? null);
      paramIndex++;

      if (data.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
        paramIndex++;
      }

      if (data.requires_proof !== undefined) {
        updates.push(`requires_proof = $${paramIndex}`);
        params.push(data.requires_proof);
        paramIndex++;
      }

      if (data.position !== undefined) {
        updates.push(`position = $${paramIndex}`);
        params.push(data.position);
        paramIndex++;
      }

      updates.push(`updated_at = current_timestamp`);
      params.push(data.id);

      const result = await app.pg.query<Price>(
        `UPDATE prices SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
      );

      price = result.rows[0];
    } else {
      let position = data.position;
      if (position === undefined) {
        const maxPositionResult = await app.pg.query<{ max_position: number | null }>(
          'SELECT MAX(position) as max_position FROM prices'
        );
        position = (maxPositionResult.rows[0]?.max_position ?? 0) + 1;
      }

      const result = await app.pg.query<Price>(
        `INSERT INTO prices (
          id, amount, audience_type, start_date, end_date, is_active, requires_proof, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          data.id,
          data.amount,
          data.audience_type,
          data.start_date ?? null,
          data.end_date ?? null,
          data.is_active ?? true,
          data.requires_proof ?? false,
          position,
        ]
      );
      price = result.rows[0];
    }
  } else {
    let position = data.position;
    if (position === undefined) {
      const maxPositionResult = await app.pg.query<{ max_position: number | null }>(
        'SELECT MAX(position) as max_position FROM prices'
      );
      position = (maxPositionResult.rows[0]?.max_position ?? 0) + 1;
    }

    const result = await app.pg.query<Price>(
      `INSERT INTO prices (
        amount, audience_type, start_date, end_date, is_active, requires_proof, position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.amount,
        data.audience_type,
        data.start_date ?? null,
        data.end_date ?? null,
        data.is_active ?? true,
        data.requires_proof ?? false,
        position,
      ]
    );
    price = result.rows[0];
  }

  await saveTranslations(app, 'price', price.id, data.translations);

  const enrichedPrice = await enrichPriceWithTranslations(app, price);
  return { price: enrichedPrice, isUpdate };
}

export async function getPrices(
  app: FastifyInstance,
  query: GetPricesQuery = {}
): Promise<Price[]> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  let sql = 'SELECT * FROM prices WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (query.audience_type) {
    sql += ` AND audience_type = $${paramIndex}`;
    params.push(query.audience_type);
    paramIndex++;
  }

  if (query.is_active !== undefined) {
    sql += ` AND is_active = $${paramIndex}`;
    params.push(query.is_active);
    paramIndex++;
  }

  if (query.date) {
    sql += ` AND (
      (start_date IS NULL AND end_date IS NULL)
      OR
      (start_date <= $${paramIndex} AND (end_date IS NULL OR end_date >= $${paramIndex}))
    )`;
    params.push(query.date, query.date);
    paramIndex += 2;
  }

  sql += ' ORDER BY position ASC, audience_type ASC, amount ASC';

  const result = await app.pg.query<Price>(sql, params);

  const enrichedPrices = await Promise.all(
    result.rows.map(price => enrichPriceWithTranslations(app, price, query.lang))
  );

  return enrichedPrices;
}

export async function getPriceById(
  app: FastifyInstance,
  id: string,
  lang?: string
): Promise<Price | null> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<Price>(
    'SELECT * FROM prices WHERE id = $1',
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return await enrichPriceWithTranslations(app, result.rows[0], lang);
}

export async function updatePrice(
  app: FastifyInstance,
  id: string,
  data: UpdatePriceBody
): Promise<Price> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const existingResult = await app.pg.query<Price>(
    'SELECT * FROM prices WHERE id = $1',
    [id]
  );

  if (!existingResult.rows[0]) {
    throw new Error('Tarif non trouvé');
  }

  const existing = existingResult.rows[0];

  if (data.amount !== undefined && data.amount < 0) {
    throw new Error('Le montant doit être positif ou nul');
  }

  const startDate = data.start_date !== undefined ? data.start_date : existing.start_date;
  const endDate = data.end_date !== undefined ? data.end_date : existing.end_date;

  if ((startDate && !endDate) || (!startDate && endDate)) {
    throw new Error('start_date et end_date doivent être définis ensemble ou laissés vides');
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      throw new Error('start_date doit être antérieure à end_date');
    }
  }

  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.amount !== undefined) {
    updates.push(`amount = $${paramIndex}`);
    params.push(data.amount);
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

  if (data.is_active !== undefined) {
    updates.push(`is_active = $${paramIndex}`);
    params.push(data.is_active);
    paramIndex++;
  }

  if (data.requires_proof !== undefined) {
    updates.push(`requires_proof = $${paramIndex}`);
    params.push(data.requires_proof);
    paramIndex++;
  }

  if (data.position !== undefined) {
    updates.push(`position = $${paramIndex}`);
    params.push(data.position);
    paramIndex++;
  }

  if (updates.length > 0) {
    updates.push(`updated_at = current_timestamp`);
    params.push(id);

    await app.pg.query(
      `UPDATE prices SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );
  }

  if (data.translations !== undefined) {
    await saveTranslations(app, 'price', id, data.translations);
  }

  const result = await app.pg.query<Price>(
    'SELECT * FROM prices WHERE id = $1',
    [id]
  );

  return await enrichPriceWithTranslations(app, result.rows[0]);
}

export async function deletePrice(
  app: FastifyInstance,
  id: string
): Promise<boolean> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  await app.pg.query(
    'DELETE FROM translations WHERE entity_type = $1 AND entity_id = $2',
    ['price', id]
  );

  const result = await app.pg.query(
    'DELETE FROM prices WHERE id = $1',
    [id]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

export async function reorderPrices(
  app: FastifyInstance,
  data: ReorderPricesBody
): Promise<Price[]> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  if (!data.price_ids || data.price_ids.length === 0) {
    throw new Error('Le tableau price_ids ne peut pas être vide');
  }

  const placeholders = data.price_ids.map((_, i) => `$${i + 1}`).join(', ');
  const existingPrices = await app.pg.query<Price>(
    `SELECT id FROM prices WHERE id IN (${placeholders})`,
    data.price_ids
  );

  if (existingPrices.rows.length !== data.price_ids.length) {
    throw new Error('Un ou plusieurs IDs de tarifs sont invalides');
  }

  try {
    await app.pg.query('BEGIN');

    for (let i = 0; i < data.price_ids.length; i++) {
      const priceId = data.price_ids[i];
      const newPosition = i + 1;

      await app.pg.query(
        'UPDATE prices SET position = $1, updated_at = current_timestamp WHERE id = $2',
        [newPosition, priceId]
      );
    }

    await app.pg.query('COMMIT');

    const result = await app.pg.query<Price>(
      `SELECT * FROM prices WHERE id IN (${placeholders}) ORDER BY position ASC`,
      data.price_ids
    );

    const enrichedPrices = await Promise.all(
      result.rows.map(price => enrichPriceWithTranslations(app, price))
    );

    return enrichedPrices;
  } catch (err) {
    await app.pg.query('ROLLBACK');
    throw err;
  }
}

