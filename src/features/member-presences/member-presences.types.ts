export type PresencePeriod = 'morning' | 'afternoon' | 'both';

export interface MemberPresence {
  id: string;
  user_id: string;
  user_name: string;
  date: string;
  period: PresencePeriod;
  refused_by_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsertPresenceBody {
  date: string;
  period: PresencePeriod;
}

export interface GetPresencesQuery {
  start_date: string;
  end_date?: string;
}

export interface PresenceDay {
  date: string;
  day_name: string;
  presences: MemberPresence[];
}

export interface PresencesResponse {
  days: PresenceDay[];
  start_date: string;
  end_date: string;
}

