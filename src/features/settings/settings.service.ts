import type { FastifyInstance } from 'fastify';
import type {
  MuseumSetting,
  UpsertSettingBody,
  GetSettingsQuery,
  SettingValueType,
  ParsedSettingValue,
} from './settings.types.ts';

/**
 * Parse une valeur selon son type
 */
function parseValue(value: string, valueType: SettingValueType): ParsedSettingValue {
  switch (valueType) {
    case 'number':
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`La valeur "${value}" ne peut pas être convertie en nombre`);
      }
      return num;
    case 'boolean':
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
      throw new Error(`La valeur "${value}" ne peut pas être convertie en booléen`);
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        throw new Error(`La valeur "${value}" n'est pas un JSON valide`);
      }
    case 'string':
    default:
      return value;
  }
}

/**
 * Convertit une valeur en string pour le stockage
 */
function stringifyValue(value: string | number | boolean | object): string {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Détecte le type d'une valeur
 */
function detectValueType(value: string | number | boolean | object): SettingValueType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'json';
  return 'string';
}

/**
 * Crée ou met à jour un paramètre (UPSERT)
 */
export async function upsertSetting(
  app: FastifyInstance,
  data: UpsertSettingBody
): Promise<MuseumSetting> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const valueType = data.value_type || detectValueType(data.value);
  const stringValue = stringifyValue(data.value);

  const result = await app.pg.query<MuseumSetting>(
    `INSERT INTO museum_settings (key, value, value_type, description)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) 
     DO UPDATE SET 
       value = $2,
       value_type = $3,
       description = $4,
       updated_at = current_timestamp
     RETURNING *`,
    [
      data.key,
      stringValue,
      valueType,
      data.description ?? null,
    ]
  );

  return result.rows[0];
}

/**
 * Récupère tous les paramètres avec filtres optionnels
 */
export async function getSettings(
  app: FastifyInstance,
  query: GetSettingsQuery = {}
): Promise<MuseumSetting[]> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  let sql = 'SELECT * FROM museum_settings WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (query.key) {
    sql += ` AND key = $${paramIndex}`;
    params.push(query.key);
    paramIndex++;
  }

  sql += ' ORDER BY key ASC';

  const result = await app.pg.query<MuseumSetting>(sql, params);
  return result.rows;
}

/**
 * Récupère un paramètre par sa clé
 */
export async function getSettingByKey(
  app: FastifyInstance,
  key: string
): Promise<MuseumSetting | null> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<MuseumSetting>(
    'SELECT * FROM museum_settings WHERE key = $1',
    [key]
  );

  return result.rows[0] || null;
}

/**
 * Récupère un paramètre par sa clé et parse la valeur selon son type
 */
export async function getSettingValue<T extends ParsedSettingValue = ParsedSettingValue>(
  app: FastifyInstance,
  key: string,
  defaultValue?: T
): Promise<T | null> {
  const setting = await getSettingByKey(app, key);

  if (!setting) {
    return defaultValue ?? null;
  }

  try {
    return parseValue(setting.value, setting.value_type) as T;
  } catch (err) {
    app.log.error({ err, key, setting }, 'Erreur lors du parsing de la valeur du paramètre');
    return defaultValue ?? null;
  }
}

/**
 * Supprime un paramètre
 */
export async function deleteSetting(
  app: FastifyInstance,
  key: string
): Promise<boolean> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query(
    'DELETE FROM museum_settings WHERE key = $1',
    [key]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Fonctions utilitaires pour les paramètres courants
 */

/**
 * Récupère la capacité maximale du musée
 */
export async function getMaxCapacity(app: FastifyInstance): Promise<number> {
  return (await getSettingValue<number>(app, 'max_capacity', 0)) || 0;
}

/**
 * Définit la capacité maximale du musée
 */
export async function setMaxCapacity(app: FastifyInstance, capacity: number): Promise<MuseumSetting> {
  return await upsertSetting(app, {
    key: 'max_capacity',
    value: capacity,
    description: 'Capacité maximale d\'accueil du musée',
  });
}

/**
 * Récupère le nombre actuel de visiteurs
 */
export async function getCurrentVisitors(app: FastifyInstance): Promise<number> {
  return (await getSettingValue<number>(app, 'current_visitors', 0)) || 0;
}

/**
 * Définit le nombre actuel de visiteurs
 */
export async function setCurrentVisitors(app: FastifyInstance, count: number): Promise<MuseumSetting> {
  return await upsertSetting(app, {
    key: 'current_visitors',
    value: count,
    description: 'Nombre actuel de visiteurs dans le musée',
  });
}

/**
 * Incrémente le nombre de visiteurs
 */
export async function incrementVisitors(app: FastifyInstance, increment: number = 1): Promise<number> {
  const current = await getCurrentVisitors(app);
  const newCount = current + increment;
  await setCurrentVisitors(app, newCount);
  return newCount;
}

/**
 * Décrémente le nombre de visiteurs
 */
export async function decrementVisitors(app: FastifyInstance, decrement: number = 1): Promise<number> {
  const current = await getCurrentVisitors(app);
  const newCount = Math.max(0, current - decrement);
  await setCurrentVisitors(app, newCount);
  return newCount;
}

