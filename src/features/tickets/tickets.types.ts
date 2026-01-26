export type TicketStatus = 'pending' | 'paid' | 'cancelled' | 'used' | 'expired';

export interface TicketPricingInfo {
  price_id?: string;
  price_name?: string;
  price_amount: number;
  audience_type?: 'public' | 'member';
  requires_proof?: boolean;
  proof_info?: {
    type?: string;
    reference?: string;
    uploaded_at?: string;
    verified?: boolean;
    verified_by?: string;
    verified_at?: string;
  };
  applied_at: string;
}

export interface Ticket {
  id: string;
  qr_code: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  reservation_date: string;
  slot_start_time: string;
  slot_end_time: string;
  checkout_id: string | null;
  checkout_reference: string | null;
  transaction_status: string | null;
  ticket_price: number;
  donation_amount: number;
  guided_tour_price: number;
  total_amount: number;
  status: TicketStatus;
  used_at: string | null;
  notes: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketBody {
  first_name?: string;
  last_name?: string;
  email: string;
  reservation_date: string;
  slot_start_time: string;
  slot_end_time: string;
  ticket_price: number;
  donation_amount?: number;
  checkout_id?: string;
  checkout_reference?: string;
  transaction_status?: string;
  notes?: string;
  pricing_info?: TicketPricingInfo;
  language?: string;
}

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
  language?: string | null;
}

export interface GetTicketsQuery {
  search?: string;
  reservation_date?: string;
  status?: TicketStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedTicketsResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ValidateTicketBody {
  qr_code: string;
}

export interface CreateTicketsWithPaymentBody {
  email?: string;
  first_name?: string;
  last_name?: string;
  language?: string;
  tickets: Array<{
    reservation_date: string;
    slot_start_time: string;
    slot_end_time: string;
    ticket_price: number;
    donation_amount?: number;
    notes?: string;
    pricing_info?: TicketPricingInfo;
  }>;
  gift_codes?: string[];
  guided_tour?: boolean;
  guided_tour_price?: number;
  currency?: string;
  description?: string;
  success_url?: string;
  cancel_url?: string;
}

export interface TicketsStatsByDay {
  date: string;
  day_name: string;
  tickets_count: number;
}

export interface HourlyStats {
  start_time: string;
  tickets_count: number;
  percentage: number;
}

export interface GroupedReservationsStats {
  total_checkouts: number;
  average_tickets_per_checkout: number;
  max_tickets_in_checkout: number;
  checkout_distribution: Array<{
    tickets_count: number;
    checkouts_count: number;
  }>;
}

export interface TicketsStats {
  total_tickets_sold: number;
  week_tickets_sold: number;
  week_tickets_by_day: TicketsStatsByDay[];
  total_donations: number;
  average_ticket_price: number;
  hourly_stats: HourlyStats[];
  grouped_reservations: GroupedReservationsStats;
  total_revenue: number;
  conversion_rate: number;
  status_distribution: {
    paid: number;
    pending: number;
    cancelled: number;
    used: number;
    expired: number;
  };
  payment_stats: {
    total_year: number;
    total_month: number;
    total_week: number;
    total_day: number;
    currency: string;
  };
}

export interface WeeklySlotStat {
  date: string;
  day_name: string;
  start_time: string;
  end_time: string;
  expected_people: number;
  capacity: number;
  occupancy_percentage: number;
  is_half_price: boolean;
}

export interface DailyTotal {
  date: string;
  day_name: string;
  total_unique_tickets: number;
}

export interface WeeklySlotsStats {
  week_start: string;
  week_end: string;
  slots_stats: WeeklySlotStat[];
  daily_totals: DailyTotal[];
}


export interface TicketHTMLOptions {
  ticket: Ticket;
  language: 'fr' | 'en';
  qrCodeBase64: string;
  logoBase64: string;
  title: string;
  greeting?: string;
  intro?: string;
  footer?: string;
  statusBadge?: {
    isValid: boolean;
    validText: string;
    invalidText: string;
    invalidReason?: string;
  };
  statusRow?: {
    label: string;
    value: string;
  };
  containerMaxWidth?: string;
  containerPadding?: string;
}