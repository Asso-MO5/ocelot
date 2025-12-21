/**
 * Types pour la gestion des tickets du musée
 */

/**
 * Statut d'un ticket
 */
export type TicketStatus = 'pending' | 'paid' | 'cancelled' | 'used' | 'expired';

/**
 * Informations de tarif stockées dans le champ notes au format JSON
 * Permet de conserver les informations de tarif au moment de la création
 * pour vérification ultérieure (notamment pour les membres avec places gratuites)
 */
export interface TicketPricingInfo {
  price_id?: string; // ID du tarif utilisé (optionnel, peut être null pour les tarifs personnalisés)
  price_name?: string; // Nom du tarif au moment de la création (pour référence)
  price_amount: number; // Montant du tarif au moment de la création
  audience_type?: 'public' | 'member'; // Type d'audience
  requires_proof?: boolean; // Si un justificatif était requis
  proof_info?: {
    type?: string; // Type de justificatif (ex: "student_card", "senior_card", "member_card")
    reference?: string; // Référence du justificatif (numéro de carte, etc.)
    uploaded_at?: string; // Date d'upload du justificatif (format ISO)
    verified?: boolean; // Si le justificatif a été vérifié
    verified_by?: string; // ID ou nom de la personne qui a vérifié
    verified_at?: string; // Date de vérification (format ISO)
  };
  applied_at: string; // Date d'application du tarif (format ISO)
}

/**
 * Ticket du musée en base de données
 */
export interface Ticket {
  id: string;
  qr_code: string; // Code QR unique (8 caractères alphanumériques majuscules)
  first_name: string | null;
  last_name: string | null;
  email: string;
  reservation_date: string; // Format YYYY-MM-DD
  slot_start_time: string; // Format HH:MM:SS
  slot_end_time: string; // Format HH:MM:SS
  checkout_id: string | null;
  checkout_reference: string | null;
  transaction_status: string | null;
  ticket_price: number;
  donation_amount: number;
  guided_tour_price: number; // Prix de la visite guidée (0 si pas de visite guidée)
  total_amount: number;
  status: TicketStatus;
  used_at: string | null;
  notes: string | null;
  language: string | null; // Code de langue (ex: 'fr', 'en', 'es')
  created_at: string;
  updated_at: string;
}

/**
 * Corps de requête pour créer un ticket
 */
export interface CreateTicketBody {
  first_name?: string;
  last_name?: string;
  email: string; // Obligatoire
  reservation_date: string; // Format YYYY-MM-DD
  slot_start_time: string; // Format HH:MM:SS
  slot_end_time: string; // Format HH:MM:SS
  ticket_price: number;
  donation_amount?: number; // Optionnel, 0 par défaut
  checkout_id?: string; // ID du checkout (optionnel au moment de la création)
  checkout_reference?: string; // Référence du checkout (optionnel)
  transaction_status?: string; // Statut de la transaction (optionnel)
  notes?: string; // Notes libres ou JSON stringifié contenant TicketPricingInfo
  pricing_info?: TicketPricingInfo; // Informations de tarif (sera stocké dans notes au format JSON)
  language?: string; // Code de langue (ex: 'fr', 'en', 'es')
}

/**
 * Corps de requête pour mettre à jour un ticket
 */
export interface UpdateTicketBody {
  first_name?: string | null;
  last_name?: string | null;
  email?: string;
  reservation_date?: string;
  slot_start_time?: string;
  slot_end_time?: string;
  ticket_price?: number;
  donation_amount?: number;
  checkout_id?: string | null;
  checkout_reference?: string | null;
  transaction_status?: string | null;
  status?: TicketStatus;
  used_at?: string | null;
  notes?: string | null;
  language?: string | null; // Code de langue (ex: 'fr', 'en', 'es')
}

/**
 * Paramètres de requête pour récupérer les tickets
 */
export interface GetTicketsQuery {
  search?: string; // Recherche textuelle dans email, first_name, last_name, checkout_id, qr_code (insensible à la casse)
  reservation_date?: string; // Filtrer par date de réservation
  status?: TicketStatus; // Filtrer par statut
  page?: number; // Numéro de page (commence à 1, optionnel, par défaut 1)
  limit?: number; // Nombre d'éléments par page (optionnel, par défaut 500)
}

/**
 * Réponse paginée pour la récupération des tickets
 */
export interface PaginatedTicketsResponse {
  tickets: Ticket[];
  total: number; // Nombre total de tickets correspondant aux filtres
  page: number; // Page actuelle
  limit: number; // Nombre d'éléments par page
  totalPages: number; // Nombre total de pages
}

/**
 * Corps de requête pour valider/utiliser un ticket (scan QR)
 */
export interface ValidateTicketBody {
  qr_code: string;
}

/**
 * Corps de requête pour créer plusieurs tickets avec paiement
 */
export interface CreateTicketsWithPaymentBody {
  email?: string; // Email commun pour tous les tickets (obligatoire uniquement si tous les tickets sont gratuites, sinon Stripe le récupère)
  first_name?: string; // Prénom commun (optionnel, Stripe le récupère si paiement)
  last_name?: string; // Nom commun (optionnel, Stripe le récupère si paiement)
  language?: string; // Code de langue (ex: 'fr', 'en', 'es')
  tickets: Array<{
    reservation_date: string; // Format YYYY-MM-DD
    slot_start_time: string; // Format HH:MM:SS
    slot_end_time: string; // Format HH:MM:SS
    ticket_price: number;
    donation_amount?: number; // Optionnel, 0 par défaut
    notes?: string; // Notes libres ou JSON stringifié contenant TicketPricingInfo
    pricing_info?: TicketPricingInfo; // Informations de tarif (sera stocké dans notes au format JSON)
  }>;
  gift_codes?: string[]; // Tableau de codes cadeaux à utiliser (optionnel)
  guided_tour?: boolean; // true si le visiteur souhaite une visite guidée (optionnel, false par défaut)
  guided_tour_price?: number; // Prix de la visite guidée (optionnel, sera récupéré depuis les settings si non fourni)
  currency?: string; // Devise pour le paiement (défaut: EUR)
  description?: string; // Description du paiement
  success_url?: string; // URL de redirection après paiement réussi (optionnel)
  cancel_url?: string; // URL de redirection en cas d'annulation (optionnel)
}

/**
 * Statistiques des tickets par jour de la semaine
 */
export interface TicketsStatsByDay {
  date: string; // Format YYYY-MM-DD
  day_name: string; // Nom du jour (lundi, mardi, etc.)
  tickets_count: number;
}

/**
 * Statistiques par horaire (slot_start_time)
 */
export interface HourlyStats {
  start_time: string; // Heure de début (HH:MM:SS)
  tickets_count: number; // Nombre de tickets vendus à cette heure
  percentage: number; // Pourcentage par rapport au total
}

/**
 * Statistiques des réservations groupées (même checkout_reference)
 */
export interface GroupedReservationsStats {
  total_checkouts: number; // Nombre total de checkout_reference uniques (avec checkout_reference non null)
  average_tickets_per_checkout: number; // Nombre moyen de tickets par checkout
  max_tickets_in_checkout: number; // Nombre maximum de tickets dans un seul checkout
  checkout_distribution: Array<{
    tickets_count: number; // Nombre de tickets dans le checkout
    checkouts_count: number; // Nombre de checkouts avec ce nombre de tickets
  }>; // Distribution du nombre de tickets par checkout
}

/**
 * Statistiques globales des tickets
 */
export interface TicketsStats {
  total_tickets_sold: number; // Nombre total de tickets vendus (status = 'paid')
  week_tickets_sold: number; // Nombre de tickets vendus cette semaine
  week_tickets_by_day: TicketsStatsByDay[]; // Répartition par jour de la semaine
  total_donations: number; // Total des dons reçus sur les tickets payés
  average_ticket_price: number; // Coût moyen d'un ticket (ticket_price)
  hourly_stats: HourlyStats[]; // Statistiques par horaire (slot_start_time)
  grouped_reservations: GroupedReservationsStats; // Stats sur les réservations groupées (même checkout_reference)
  total_revenue: number; // Total des revenus (ticket_price + donation_amount) pour les tickets payés
  conversion_rate: number; // Taux de conversion (paid / (paid + pending)) en pourcentage
  status_distribution: {
    paid: number;
    pending: number;
    cancelled: number;
    used: number;
    expired: number;
  }; // Répartition par statut
}

/**
 * Statistiques d'un créneau horaire pour un jour donné de la semaine courante
 */
export interface WeeklySlotStat {
  date: string; // Format YYYY-MM-DD
  day_name: string; // Nom du jour (lundi, mardi, etc.)
  start_time: string; // Heure de début du créneau (HH:MM:SS)
  end_time: string; // Heure de fin du créneau (HH:MM:SS)
  expected_people: number; // Nombre de personnes attendues (tickets pending + paid)
  capacity: number; // Capacité maximale du créneau (setting capacity)
  occupancy_percentage: number; // Pourcentage d'occupation (0-100)
  is_half_price: boolean; // true si créneau incomplet (demi-tarif)
}

/**
 * Statistiques quotidiennes (total unique de tickets par jour)
 */
export interface DailyTotal {
  date: string; // Format YYYY-MM-DD
  day_name: string; // Nom du jour (lundi, mardi, etc.)
  total_unique_tickets: number; // Nombre unique de tickets attendus dans la journée (sans double comptage)
}

/**
 * Statistiques des créneaux horaires pour la semaine courante
 */
export interface WeeklySlotsStats {
  week_start: string; // Date du lundi de la semaine courante (YYYY-MM-DD)
  week_end: string; // Date du dimanche de la semaine courante (YYYY-MM-DD)
  slots_stats: WeeklySlotStat[]; // Stats par créneau horaire (jauge horaire)
  daily_totals: DailyTotal[]; // Total unique de tickets par jour (pour distinguer du nombre de présences horaires)
}


