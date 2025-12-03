/**
 * Types pour la gestion des périodes spéciales (vacances, fermetures)
 */

/**
 * Type de période spéciale
 */
export type SpecialPeriodType = 'holiday' | 'closure';

/**
 * Période spéciale en base de données
 */
export interface SpecialPeriod {
  id: string;
  type: SpecialPeriodType;
  start_date: string; // Format YYYY-MM-DD
  end_date: string; // Format YYYY-MM-DD
  name: string | null;
  description: string | null;
  zone: string | null; // Zone pour les vacances scolaires (ex: "A", "B", "C", "all")
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Corps de requête pour créer une période spéciale
 */
export interface CreateSpecialPeriodBody {
  type: SpecialPeriodType;
  start_date: string; // Format YYYY-MM-DD
  end_date: string; // Format YYYY-MM-DD
  name?: string;
  description?: string;
  zone?: string; // Pour les vacances scolaires
  is_active?: boolean;
}

/**
 * Corps de requête pour mettre à jour une période spéciale
 */
export interface UpdateSpecialPeriodBody {
  type?: SpecialPeriodType;
  start_date?: string;
  end_date?: string;
  name?: string | null;
  description?: string | null;
  zone?: string | null;
  is_active?: boolean;
}

/**
 * Paramètres de requête pour récupérer les périodes spéciales
 */
export interface GetSpecialPeriodsQuery {
  type?: SpecialPeriodType;
  date?: string; // Pour vérifier si une date est dans une période spéciale
  zone?: string; // Filtrer par zone
  is_active?: boolean;
}

