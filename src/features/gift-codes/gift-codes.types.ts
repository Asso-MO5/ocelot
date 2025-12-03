/**
 * Types pour la gestion des codes cadeaux
 */

/**
 * Statut d'un code cadeau
 */
export type GiftCodeStatus = 'unused' | 'used' | 'expired';

/**
 * Code cadeau en base de données
 */
export interface GiftCode {
  id: string;
  code: string; // Code unique (12 caractères alphanumériques)
  status: GiftCodeStatus;
  ticket_id: string | null; // Ticket associé (null si non utilisé)
  pack_id: string | null; // Pack auquel appartient ce code
  recipient_email: string | null; // Email du destinataire
  expires_at: string | null; // Date d'expiration (optionnelle)
  used_at: string | null; // Date d'utilisation
  notes: string | null; // Notes optionnelles
  created_at: string;
  updated_at: string;
}

/**
 * Corps de requête pour créer un pack de codes cadeaux
 */
export interface CreateGiftCodePackBody {
  quantity: number; // Nombre de codes à créer
  pack_name?: string; // Nom du pack (optionnel)
  expires_at?: string; // Date d'expiration (optionnelle, format ISO)
  notes?: string; // Notes optionnelles
}

/**
 * Corps de requête pour distribuer des codes par email
 */
export interface DistributeGiftCodesBody {
  code_ids: string[]; // IDs des codes à distribuer
  recipient_email: string; // Email du destinataire
  subject?: string; // Sujet de l'email (optionnel)
  message?: string; // Message personnalisé (optionnel)
  language?: 'fr' | 'en'; // Langue de l'email
}

/**
 * Paramètres de requête pour récupérer les codes cadeaux
 */
export interface GetGiftCodesQuery {
  status?: GiftCodeStatus; // Filtrer par statut
  pack_id?: string; // Filtrer par pack
  recipient_email?: string; // Filtrer par destinataire
  ticket_id?: string; // Filtrer par ticket
  page?: number; // Numéro de page (commence à 1, optionnel, par défaut 1)
  limit?: number; // Nombre d'éléments par page (optionnel, par défaut 100)
}

/**
 * Réponse paginée pour la récupération des codes cadeaux
 */
export interface PaginatedGiftCodesResponse {
  codes: GiftCode[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Résultat de la création d'un pack de codes
 */
export interface GiftCodePackResult {
  pack_id: string;
  codes: GiftCode[];
  quantity: number;
}

/**
 * Pack de codes cadeaux avec ses codes associés
 */
export interface GiftCodePackWithCodes {
  pack_id: string;
  codes: GiftCode[];
  codes_count: number;
  unused_count: number;
  used_count: number;
  expired_count: number;
  created_at: string;
}

/**
 * Paramètres de requête pour récupérer les packs de codes cadeaux
 */
export interface GetGiftCodePacksQuery {
  code?: string; // Rechercher un code spécifique (retourne le pack qui le contient)
  page?: number; // Numéro de page (commence à 1, optionnel, par défaut 1)
  limit?: number; // Nombre d'éléments par page (optionnel, par défaut 50)
}

/**
 * Réponse paginée pour la récupération des packs de codes cadeaux
 */
export interface PaginatedGiftCodePacksResponse {
  packs: GiftCodePackWithCodes[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

