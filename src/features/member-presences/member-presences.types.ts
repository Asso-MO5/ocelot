/**
 * Période de présence
 */
export type PresencePeriod = 'morning' | 'afternoon' | 'both';

/**
 * Présence d'un membre
 */
export interface MemberPresence {
  id: string;
  user_id: string;
  user_name: string; // Nom du membre récupéré via relation
  date: string; // Format YYYY-MM-DD
  period: PresencePeriod;
  refused_by_admin: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Corps de requête pour créer ou mettre à jour une présence
 */
export interface UpsertPresenceBody {
  date: string; // Format YYYY-MM-DD
  period: PresencePeriod;
}

/**
 * Paramètres de requête pour récupérer les présences
 */
export interface GetPresencesQuery {
  start_date: string; // Date de début (requis)
  end_date?: string; // Date de fin (optionnel, par défaut = start_date)
}

/**
 * Jour avec ses présences
 */
export interface PresenceDay {
  date: string; // Format YYYY-MM-DD
  day_name: string; // Nom du jour (ex: "Lundi", "Mardi")
  presences: MemberPresence[];
}

/**
 * Réponse pour récupérer les présences
 */
export interface PresencesResponse {
  days: PresenceDay[];
  start_date: string;
  end_date: string;
}

