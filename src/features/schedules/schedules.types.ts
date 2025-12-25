import type { AudienceType } from '../shared.types.ts';

export interface Schedule {
  id: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  audience_type: AudienceType;
  start_date: string | null;
  end_date: string | null;
  is_exception: boolean;
  is_closed: boolean;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleBody {
  day_of_week?: number;
  start_time: string;
  end_time: string;
  audience_type: AudienceType;
  start_date?: string;
  end_date?: string;
  is_exception?: boolean;
  is_closed?: boolean;
  description?: string;
  position?: number;
}

export interface UpdateScheduleBody {
  day_of_week?: number | null;
  start_time?: string;
  end_time?: string;
  audience_type?: AudienceType;
  start_date?: string | null;
  end_date?: string | null;
  is_exception?: boolean;
  is_closed?: boolean;
  description?: string | null;
  position?: number;
}

export interface ReorderSchedulesBody {
  schedule_ids: string[];
}

export interface GetSchedulesQuery {
  day_of_week?: number;
  audience_type?: AudienceType;
  date?: string;
  include_exceptions?: boolean;
}

export interface GetPublicSchedulesQuery {
  day_of_week?: number;
  date?: string;
  include_exceptions?: boolean;
}

export interface SpecialPeriodInfo {
  id: string;
  name: string | null;
  start_date: string;
  end_date: string;
  zone: string | null;
}

export interface PublicSchedule extends Schedule {
  holiday_periods: SpecialPeriodInfo[];
  closure_periods: SpecialPeriodInfo[];
}

