export interface CheckoutSessionRequest {
  amount: number;
  currency: string;
  description?: string;
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResponse {
  id: string; // session_id
  url: string; // checkout_url
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
}

/**
 * Corps de requête du webhook pour les notifications de paiement
 * Format standard Stripe Event
 */
export interface WebhookBody {
  id: string; // ID de l'événement
  type: string; // Type d'événement (checkout.session.completed, payment_intent.succeeded, etc.)
  created: number; // Timestamp Unix
  data: {
    object: {
      id: string; // session_id ou payment_intent_id
      object: string; // 'checkout.session' ou 'payment_intent'
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

export interface PaymentStats {
  total_all_time: number;
  total_month: number;
  total_week: number;
  total_day: number;
  currency: string;
}

