/**
 * Types pour la gestion des horaires du musée
 */

import type { AudienceType } from '../shared.types.ts';

/**
 * Jour de la semaine (0 = dimanche, 1 = lundi, ..., 6 = samedi)
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Horaire du musée en base de données
 */
export interface Schedule {
  id: string;
  day_of_week: number | null;
  start_time: string; // Format HH:MM:SS
  end_time: string; // Format HH:MM:SS
  audience_type: AudienceType;
  start_date: string | null; // Format YYYY-MM-DD
  end_date: string | null; // Format YYYY-MM-DD
  is_exception: boolean;
  is_closed: boolean;
  description: string | null;
  position: number; // Position pour l'ordre d'affichage
  created_at: string;
  updated_at: string;
}

/**
 * Corps de requête pour créer un horaire
 */
export interface CreateScheduleBody {
  day_of_week?: number;
  start_time: string;
  end_time: string;
  audience_type: AudienceType;
  start_date?: string;
  end_date?: string;
  is_exception?: boolean;
  is_closed?: boolean;
  description?: string;
  position?: number; // Position pour l'ordre d'affichage (optionnel, sera auto-assignée si non fournie)
}

/**
 * Corps de requête pour mettre à jour un horaire
 */
export interface UpdateScheduleBody {
  day_of_week?: number | null;
  start_time?: string;
  end_time?: string;
  audience_type?: AudienceType;
  start_date?: string | null;
  end_date?: string | null;
  is_exception?: boolean;
  is_closed?: boolean;
  description?: string | null;
  position?: number;
}

/**
 * Corps de requête pour réordonner les horaires
 */
export interface ReorderSchedulesBody {
  schedule_ids: string[]; // Tableau d'IDs dans l'ordre souhaité
}

/**
 * Paramètres de requête pour récupérer les horaires
 */
export interface GetSchedulesQuery {
  day_of_week?: number;
  audience_type?: AudienceType;
  date?: string; // Pour récupérer les horaires pour une date spécifique
  include_exceptions?: boolean;
}

/**
 * Paramètres de requête pour récupérer les horaires publics (sans audience_type)
 */
export interface GetPublicSchedulesQuery {
  day_of_week?: number;
  date?: string; // Pour récupérer les horaires pour une date spécifique
  include_exceptions?: boolean;
}

