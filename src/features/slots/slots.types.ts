/**
 * Types pour la gestion des créneaux horaires (slots) du musée
 */

/**
 * Créneau horaire avec sa capacité
 */
export interface Slot {
  start_time: string; // Format HH:MM:SS
  end_time: string; // Format HH:MM:SS
  capacity: number; // Capacité maximale du créneau
  booked: number; // Nombre de tickets réservés pour ce créneau
  available: number; // Nombre de places disponibles
  occupancy_percentage: number; // Pourcentage d'occupation (0-100)
}

/**
 * Paramètres de requête pour récupérer les slots
 */
export interface GetSlotsQuery {
  date: string; // Format YYYY-MM-DD
}

/**
 * Réponse pour les slots d'une journée
 */
export interface GetSlotsResponse {
  date: string; // Format YYYY-MM-DD
  slots: Slot[];
  total_capacity: number; // Capacité totale de la journée
  total_booked: number; // Nombre total de tickets réservés
  total_available: number; // Nombre total de places disponibles
}

