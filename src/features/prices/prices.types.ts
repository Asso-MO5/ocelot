/**
 * Types pour la gestion des tarifs du musée
 */

import type { AudienceType } from '../shared.types.ts';

/**
 * Traduction d'un champ
 */
export interface Translation {
  lang: string;
  field_name: string;
  translation: string;
}

/**
 * Tarif du musée en base de données
 */
export interface Price {
  id: string;
  amount: number; // En euros
  audience_type: AudienceType;
  start_date: string | null; // Format YYYY-MM-DD
  end_date: string | null; // Format YYYY-MM-DD
  is_active: boolean;
  requires_proof: boolean; // Indique si le tarif nécessite un justificatif
  position: number; // Position pour l'ordre d'affichage
  created_at: string;
  updated_at: string;
  // Traductions (peuvent être présentes selon la langue demandée)
  translations?: Record<string, Record<string, string>>; // { lang: { field_name: translation } }
  // Champs traduits pour faciliter l'utilisation (optionnel, dépend de la langue)
  name?: string;
  description?: string | null;
}

/**
 * Corps de requête pour créer un tarif (upsert)
 */
export interface CreatePriceBody {
  id?: string; // ID optionnel pour l'upsert : si fourni et existe, met à jour ; sinon crée
  amount: number;
  audience_type: AudienceType;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  requires_proof?: boolean;
  translations: Translation[]; // Traductions pour name et description
  position?: number; // Position pour l'ordre d'affichage (optionnel, sera auto-assignée si non fournie)
}

/**
 * Corps de requête pour mettre à jour un tarif
 */
export interface UpdatePriceBody {
  amount?: number;
  audience_type?: AudienceType;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  requires_proof?: boolean;
  translations?: Translation[]; // Traductions pour name et description
  position?: number;
}

/**
 * Corps de requête pour réordonner les tarifs
 */
export interface ReorderPricesBody {
  price_ids: string[]; // Tableau d'IDs dans l'ordre souhaité
}

/**
 * Paramètres de requête pour récupérer les tarifs
 */
export interface GetPricesQuery {
  audience_type?: AudienceType;
  date?: string; // Pour récupérer les tarifs valides pour une date spécifique
  is_active?: boolean;
  lang?: string; // Langue pour les traductions (ex: 'fr', 'en'). Si non fourni, retourne toutes les traductions
}

