export type SpecialPeriodType = 'holiday' | 'closure';

export interface SpecialPeriod {
  id: string;
  type: SpecialPeriodType;
  start_date: string;
  end_date: string;
  name: string | null;
  description: string | null;
  zone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSpecialPeriodBody {
  type: SpecialPeriodType;
  start_date: string;
  end_date: string;
  name?: string;
  description?: string;
  zone?: string;
  is_active?: boolean;
}

export interface UpdateSpecialPeriodBody {
  type?: SpecialPeriodType;
  start_date?: string;
  end_date?: string;
  name?: string | null;
  description?: string | null;
  zone?: string | null;
  is_active?: boolean;
}

export interface GetSpecialPeriodsQuery {
  type?: SpecialPeriodType;
  date?: string;
  zone?: string;
  is_active?: boolean;
}

