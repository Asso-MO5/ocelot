/**
 * Types pour la gestion des événements
 */

/**
 * Type d'événement
 */
export type EventType = 'museum' | 'association' | 'external';

/**
 * Catégorie d'événement (pour les événements musée)
 */
export type EventCategory = 'live' | 'mediation' | 'workshop' | 'conference' | 'exhibition' | 'other';

/**
 * Statut de visibilité de l'événement
 */
export type EventStatus = 'draft' | 'private' | 'member' | 'public';

/**
 * Rôle de gestionnaire
 */
export type EventManagerRole = 'dev' | 'bureau' | 'museum' | 'com';

/**
 * Type de localisation
 */
export type EventLocationType = 'museum' | 'external';

/**
 * Type de relation entre événements
 */
export type EventRelationType = 'related' | 'sub_event';

/**
 * Événement en base de données
 */
export interface Event {
  id: string;
  type: EventType;
  category: EventCategory | null;
  status: EventStatus;
  start_date: string; // Format YYYY-MM-DD
  end_date: string | null;
  start_time: string | null; // Format HH:MM:SS
  end_time: string | null; // Format HH:MM:SS
  location_type: EventLocationType;
  location_name: string | null;
  location_address: string | null;
  location_city: string | null;
  location_postal_code: string | null;
  public_title_fr: string | null;
  public_title_en: string | null;
  public_description_fr: string | null;
  public_description_en: string | null;
  public_image_url: string | null;
  private_notes: string | null;
  private_contact: string | null;
  manager_dev: boolean;
  manager_bureau: boolean;
  manager_museum: boolean;
  manager_com: boolean;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Relations (peuvent être présentes selon la requête)
  related_events?: Event[];
  parent_events?: Event[];
}

/**
 * Corps de requête pour créer un événement
 */
export interface CreateEventBody {
  type: EventType;
  category?: EventCategory;
  status?: EventStatus;
  start_date: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location_type?: EventLocationType;
  location_name?: string | null;
  location_address?: string | null;
  location_city?: string | null;
  location_postal_code?: string | null;
  public_title_fr?: string | null;
  public_title_en?: string | null;
  public_description_fr?: string | null;
  public_description_en?: string | null;
  public_image_url?: string | null;
  private_notes?: string | null;
  private_contact?: string | null;
  manager_dev?: boolean;
  manager_bureau?: boolean;
  manager_museum?: boolean;
  manager_com?: boolean;
  capacity?: number | null;
  is_active?: boolean;
  related_event_ids?: string[]; // IDs des événements à lier
}

/**
 * Corps de requête pour mettre à jour un événement
 */
export interface UpdateEventBody {
  type?: EventType;
  category?: EventCategory | null;
  status?: EventStatus;
  start_date?: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location_type?: EventLocationType;
  location_name?: string | null;
  location_address?: string | null;
  location_city?: string | null;
  location_postal_code?: string | null;
  public_title_fr?: string | null;
  public_title_en?: string | null;
  public_description_fr?: string | null;
  public_description_en?: string | null;
  public_image_url?: string | null;
  private_notes?: string | null;
  private_contact?: string | null;
  manager_dev?: boolean;
  manager_bureau?: boolean;
  manager_museum?: boolean;
  manager_com?: boolean;
  capacity?: number | null;
  is_active?: boolean;
  related_event_ids?: string[]; // IDs des événements à lier (remplace les relations existantes)
}

/**
 * Paramètres de requête pour récupérer les événements
 */
export interface GetEventsQuery {
  type?: EventType;
  category?: EventCategory;
  status?: EventStatus;
  start_date?: string; // Date de début minimale
  end_date?: string; // Date de fin maximale
  date?: string; // Date spécifique (événements qui incluent cette date)
  location_type?: EventLocationType;
  is_active?: boolean;
  include_relations?: boolean; // Inclure les événements liés
  page?: number;
  limit?: number;
}

/**
 * Réponse paginée pour les événements
 */
export interface PaginatedEventsResponse {
  events: Event[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Jour du calendrier avec événements et horaires
 */
export interface CalendarDay {
  date: string; // Format YYYY-MM-DD
  is_open: boolean; // Le musée est-il ouvert ce jour ?
  opening_hours: Array<{
    start_time: string;
    end_time: string;
    audience_type: string;
    description: string | null;
  }>; // Horaires d'ouverture du musée
  events: Event[]; // Événements de ce jour
  holiday_periods: Array<{
    id: string;
    name: string | null;
    start_date: string;
    end_date: string;
    zone: string | null;
  }>; // Périodes de vacances actives ce jour
  closure_periods: Array<{
    id: string;
    name: string | null;
    start_date: string;
    end_date: string;
    zone: string | null;
  }>; // Périodes de fermeture actives ce jour
}

/**
 * Paramètres de requête pour le calendrier
 */
export interface GetCalendarQuery {
  start_date: string; // Date de début (requis)
  end_date?: string; // Date de fin (optionnel, par défaut = start_date)
  view?: 'day' | 'week' | 'month'; // Vue du calendrier
  status?: EventStatus; // Filtrer par statut d'événement (par défaut: 'public' et 'member')
  include_private?: boolean; // Inclure les événements privés (admin uniquement)
  event_types?: EventType[]; // Filtrer par types d'événements (par défaut: tous les types)
}

/**
 * Réponse du calendrier
 */
export interface CalendarResponse {
  days: CalendarDay[];
  start_date: string;
  end_date: string;
  view: 'day' | 'week' | 'month';
}

