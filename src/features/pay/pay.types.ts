export interface CheckoutSessionResponse {
  id: string;
  url: string;
  amount_total: number;
  currency: string;
  status?: 'open' | 'complete' | 'expired';
  payment_status?: 'paid' | 'unpaid' | 'no_payment_required';
}

export interface CheckoutStatus {
  id: string;
  amount_total: number;
  currency: string;
  status: 'open' | 'complete' | 'expired';
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  payment_intent?: string;
  metadata?: Record<string, string>;
}

export interface WebhookBody {
  id: string;
  type: string;
  created: number;
  data: {
    object: {
      id: string;
      object: string;
      amount_total?: number;
      currency?: string;
      status?: string;
      payment_status?: string;
      payment_intent?: string;
      metadata?: Record<string, string>;
      [key: string]: any;
    };
  };
}


