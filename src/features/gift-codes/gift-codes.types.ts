export type GiftCodeStatus = 'unused' | 'used' | 'expired';

export interface GiftCode {
  id: string;
  code: string;
  status: GiftCodeStatus;
  ticket_id: string | null;
  pack_id: string | null;
  recipient_email: string | null;
  expires_at: string | null;
  used_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGiftCodePackBody {
  quantity: number;
  pack_name?: string;
  expires_at?: string;
  notes?: string;
}

export interface DistributeGiftCodesBody {
  code_ids: string[];
  recipient_email: string;
  subject?: string;
  message?: string;
  language?: 'fr' | 'en';
}

export interface GetGiftCodesQuery {
  status?: GiftCodeStatus;
  pack_id?: string;
  recipient_email?: string;
  ticket_id?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedGiftCodesResponse {
  codes: GiftCode[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GiftCodePackResult {
  pack_id: string;
  codes: GiftCode[];
  quantity: number;
}

export interface GiftCodePackWithCodes {
  pack_id: string;
  codes: GiftCode[];
  codes_count: number;
  unused_count: number;
  used_count: number;
  expired_count: number;
  created_at: string;
}

export interface GetGiftCodePacksQuery {
  code?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedGiftCodePacksResponse {
  packs: GiftCodePackWithCodes[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PurchaseGiftCodesBody {
  quantity: number;
  email: string;
  language?: 'fr' | 'en';
  success_url: string;
  cancel_url: string;
}

export interface ConfirmPurchaseGiftCodesBody {
  checkout_id: string;
}

