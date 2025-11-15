/**
 * Types pour la gestion des paramètres du musée
 */

/**
 * Type de valeur pour un paramètre
 */
export type SettingValueType = 'string' | 'number' | 'boolean' | 'json';

/**
 * Paramètre du musée en base de données
 */
export interface MuseumSetting {
  id: string;
  key: string;
  value: string; // Stocké en texte, à parser selon value_type
  value_type: SettingValueType;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Corps de requête pour créer ou mettre à jour un paramètre
 */
export interface UpsertSettingBody {
  key: string;
  value: string | number | boolean | object;
  value_type?: SettingValueType; // Auto-détecté si non fourni
  description?: string;
}

/**
 * Paramètres de requête pour récupérer les paramètres
 */
export interface GetSettingsQuery {
  key?: string; // Filtrer par clé spécifique
}

/**
 * Valeur parsée d'un paramètre selon son type
 */
export type ParsedSettingValue = string | number | boolean | object;

