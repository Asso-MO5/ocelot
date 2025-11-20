import type { FastifyInstance } from 'fastify';
import type {
  Price,
  CreatePriceBody,
  UpdatePriceBody,
  GetPricesQuery,
  Translation,
} from './prices.types.ts';

/**
 * Sauvegarde les traductions pour une entité
 */
async function saveTranslations(
  app: FastifyInstance,
  entityType: string,
  entityId: string,
  translations: Translation[]
): Promise<void> {
  if (!app.pg || translations.length === 0) {
    return;
  }

  // Supprimer les traductions existantes pour cette entité
  await app.pg.query(
    'DELETE FROM translations WHERE entity_type = $1 AND entity_id = $2',
    [entityType, entityId]
  );

  // Insérer les nouvelles traductions
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

/**
 * Récupère les traductions pour une entité
 */
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

  // Organiser les traductions par langue puis par champ
  const translations: Record<string, Record<string, string>> = {};
  for (const row of result.rows) {
    if (!translations[row.lang]) {
      translations[row.lang] = {};
    }
    translations[row.lang][row.field_name] = row.translation;
  }

  return translations;
}

/**
 * Enrichit un prix avec ses traductions
 */
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

  // Si une langue spécifique est demandée, ajouter les champs name et description directement
  if (lang && translations[lang]) {
    enriched.name = translations[lang]['name'];
    enriched.description = translations[lang]['description'] || null;
  }

  return enriched;
}

/**
 * Crée ou met à jour un tarif (upsert)
 * Si un id est fourni et existe, met à jour le tarif
 * Sinon, crée un nouveau tarif
 */
export async function createPrice(
  app: FastifyInstance,
  data: CreatePriceBody
): Promise<{ price: Price; isUpdate: boolean }> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Validation : montant doit être positif
  if (data.amount < 0) {
    throw new Error('Le montant doit être positif ou nul');
  }

  // Validation : si start_date est défini, end_date doit aussi l'être (ou vice versa)
  if ((data.start_date && !data.end_date) || (!data.start_date && data.end_date)) {
    throw new Error('start_date et end_date doivent être définis ensemble ou laissés vides');
  }

  // Validation : start_date doit être avant end_date
  if (data.start_date && data.end_date) {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    if (start >= end) {
      throw new Error('start_date doit être antérieure à end_date');
    }
  }

  // Validation : au moins une traduction pour name doit être fournie
  const nameTranslations = data.translations.filter(t => t.field_name === 'name');
  if (nameTranslations.length === 0) {
    throw new Error('Au moins une traduction pour le champ "name" est requise');
  }

  let price: Price;
  let isUpdate = false;

  // Si un ID est fourni, vérifier s'il existe
  if (data.id) {
    const existing = await app.pg.query<Price>(
      'SELECT * FROM prices WHERE id = $1',
      [data.id]
    );

    if (existing.rows[0]) {
      // Mettre à jour le tarif existant
      isUpdate = true;

      // Construire la requête de mise à jour
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

      updates.push(`updated_at = current_timestamp`);
      params.push(data.id);

      const result = await app.pg.query<Price>(
        `UPDATE prices SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
      );

      price = result.rows[0];
    } else {
      // Créer un nouveau tarif avec l'ID fourni
      const result = await app.pg.query<Price>(
        `INSERT INTO prices (
          id, amount, audience_type, start_date, end_date, is_active, requires_proof
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          data.id,
          data.amount,
          data.audience_type,
          data.start_date ?? null,
          data.end_date ?? null,
          data.is_active ?? true,
          data.requires_proof ?? false,
        ]
      );
      price = result.rows[0];
    }
  } else {
    // Créer un nouveau tarif sans ID (génération automatique)
    const result = await app.pg.query<Price>(
      `INSERT INTO prices (
        amount, audience_type, start_date, end_date, is_active, requires_proof
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        data.amount,
        data.audience_type,
        data.start_date ?? null,
        data.end_date ?? null,
        data.is_active ?? true,
        data.requires_proof ?? false,
      ]
    );
    price = result.rows[0];
  }

  // Sauvegarder les traductions (écrase les anciennes si mise à jour)
  await saveTranslations(app, 'price', price.id, data.translations);

  // Retourner le prix enrichi avec les traductions
  const enrichedPrice = await enrichPriceWithTranslations(app, price);
  return { price: enrichedPrice, isUpdate };
}

/**
 * Récupère tous les tarifs avec filtres optionnels
 */
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
    // Pour une date spécifique, on cherche les tarifs valides :
    // 1. Sans dates de validité (start_date IS NULL AND end_date IS NULL)
    // 2. Avec dates de validité qui couvrent la date demandée
    sql += ` AND (
      (start_date IS NULL AND end_date IS NULL)
      OR
      (start_date <= $${paramIndex} AND (end_date IS NULL OR end_date >= $${paramIndex}))
    )`;
    params.push(query.date, query.date);
    paramIndex += 2;
  }

  sql += ' ORDER BY audience_type ASC, amount ASC';

  const result = await app.pg.query<Price>(sql, params);

  // Enrichir chaque prix avec ses traductions
  const enrichedPrices = await Promise.all(
    result.rows.map(price => enrichPriceWithTranslations(app, price, query.lang))
  );

  return enrichedPrices;
}

/**
 * Récupère un tarif par son ID
 */
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

  // Enrichir avec les traductions
  return await enrichPriceWithTranslations(app, result.rows[0], lang);
}

/**
 * Met à jour un tarif
 */
export async function updatePrice(
  app: FastifyInstance,
  id: string,
  data: UpdatePriceBody
): Promise<Price> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Vérifier que le tarif existe (sans traductions pour la vérification)
  const existingResult = await app.pg.query<Price>(
    'SELECT * FROM prices WHERE id = $1',
    [id]
  );

  if (!existingResult.rows[0]) {
    throw new Error('Tarif non trouvé');
  }

  const existing = existingResult.rows[0];

  // Validation : montant doit être positif
  if (data.amount !== undefined && data.amount < 0) {
    throw new Error('Le montant doit être positif ou nul');
  }

  // Validation : dates de validité
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

  // Construire la requête de mise à jour dynamiquement
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

  // Mettre à jour le tarif si nécessaire
  if (updates.length > 0) {
    updates.push(`updated_at = current_timestamp`);
    params.push(id);

    await app.pg.query(
      `UPDATE prices SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );
  }

  // Mettre à jour les traductions si fournies
  if (data.translations !== undefined) {
    await saveTranslations(app, 'price', id, data.translations);
  }

  // Récupérer le tarif mis à jour avec les traductions
  const result = await app.pg.query<Price>(
    'SELECT * FROM prices WHERE id = $1',
    [id]
  );

  return await enrichPriceWithTranslations(app, result.rows[0]);
}

/**
 * Supprime un tarif
 */
export async function deletePrice(
  app: FastifyInstance,
  id: string
): Promise<boolean> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Supprimer d'abord les traductions associées
  await app.pg.query(
    'DELETE FROM translations WHERE entity_type = $1 AND entity_id = $2',
    ['price', id]
  );

  // Supprimer le tarif
  const result = await app.pg.query(
    'DELETE FROM prices WHERE id = $1',
    [id]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

