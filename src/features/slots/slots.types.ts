export interface Slot {
  start_time: string;
  end_time: string;
  capacity: number;
  booked: number;
  available: number;
  occupancy_percentage: number;
  is_half_price: boolean;
}

export interface GetSlotsQuery {
  date: string;
}

export interface GetSlotsResponse {
  date: string;
  slots: Slot[];
  total_capacity: number;
  total_booked: number;
  total_available: number;
}

