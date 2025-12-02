/**
 * Types pour le module donation-proof
 */

export interface GenerateDonationProofQuery {
  ticket_id: string;
  address?: string;
  postal_code?: string;
  city?: string;
}

export interface GenerateDonationProofResponse {
  success: boolean;
  message?: string;
}

