export interface GenerateDonationProofQuery {
  ticket_id: string;
  address?: string;
  postal_code?: string;
  city?: string;
}
