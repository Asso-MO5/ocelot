import type { AudienceType } from '../shared.types.ts';

export interface Translation {
  lang: string;
  field_name: string;
  translation: string;
}

export interface Price {
  id: string;
  amount: number;
  audience_type: AudienceType;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  requires_proof: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  translations?: Record<string, Record<string, string>>;
  name?: string;
  description?: string | null;
}

export interface CreatePriceBody {
  id?: string;
  amount: number;
  audience_type: AudienceType;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  requires_proof?: boolean;
  translations: Translation[];
  position?: number;
}

export interface UpdatePriceBody {
  amount?: number;
  audience_type?: AudienceType;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  requires_proof?: boolean;
  translations?: Translation[];
  position?: number;
}

export interface ReorderPricesBody {
  price_ids: string[];
}

export interface GetPricesQuery {
  audience_type?: AudienceType;
  date?: string;
  is_active?: boolean;
  lang?: string;
}

