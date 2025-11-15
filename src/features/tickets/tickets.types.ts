/**
 * Types pour la gestion des tickets du musée
 */

/**
 * Statut d'un ticket
 */
export type TicketStatus = 'pending' | 'paid' | 'cancelled' | 'used' | 'expired';

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
  total_amount: number;
  status: TicketStatus;
  used_at: string | null;
  notes: string | null;
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
  checkout_id?: string; // ID du checkout SumUp (optionnel au moment de la création)
  checkout_reference?: string; // Référence du checkout SumUp (optionnel)
  transaction_status?: string; // Statut de la transaction (optionnel)
  notes?: string;
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
}

/**
 * Paramètres de requête pour récupérer les tickets
 */
export interface GetTicketsQuery {
  email?: string; // Filtrer par email
  reservation_date?: string; // Filtrer par date de réservation
  status?: TicketStatus; // Filtrer par statut
  checkout_id?: string; // Filtrer par checkout ID
  qr_code?: string; // Filtrer par code QR
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
  email: string; // Email commun pour tous les tickets
  first_name?: string; // Nom commun (optionnel)
  last_name?: string; // Prénom commun (optionnel)
  tickets: Array<{
    reservation_date: string; // Format YYYY-MM-DD
    slot_start_time: string; // Format HH:MM:SS
    slot_end_time: string; // Format HH:MM:SS
    ticket_price: number;
    donation_amount?: number; // Optionnel, 0 par défaut
    notes?: string; // Notes spécifiques à ce ticket
  }>;
  currency?: string; // Devise pour le paiement (défaut: EUR)
  description?: string; // Description du paiement
}

