export interface SumUpCheckoutRequest {
  checkout_reference: string;
  amount: number;
  currency: string;
  merchant_code: string;
  description?: string;
  return_url?: string;
  redirect_url?: string;
}

export interface SumUpCheckoutResponse {
  id: string;
  checkout_reference: string;
  amount: number;
  currency: string;
  merchant_code: string;
  status: string;
  payment_type?: string;
  redirect_url?: string;
  events?: Array<{
    id: string;
    type: string;
    timestamp: string;
    amount?: number;
  }>;
}

export interface SumUpCheckoutStatus {
  id: string;
  checkout_reference: string;
  amount: number;
  currency: string;
  merchant_code: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'SENT' | 'SUCCESS';
  payment_type?: string;
  transaction_code?: string;
  events?: Array<{
    id: string;
    type: string;
    timestamp: string;
    amount?: number;
  }>;
}

export interface CreateCheckoutBody {
  amount: number;
  currency?: string;
  description?: string;
  checkout_reference: string;
  merchant_code: string;
}

export interface CheckoutResponse {
  checkout_id: string;
  checkout_reference: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Corps de requête du webhook SumUp pour les notifications de paiement
 */
export interface SumUpWebhookBody {
  id?: string; // ID de l'événement
  type?: string; // Type d'événement (checkout.payment.succeeded, checkout.payment.failed, etc.)
  timestamp?: string; // Timestamp de l'événement
  checkout_id?: string; // ID du checkout
  checkout_reference?: string; // Référence du checkout
  amount?: number; // Montant
  currency?: string; // Devise
  status?: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'SENT' | 'SUCCESS'; // Statut du checkout
  payment_type?: string; // Type de paiement
  transaction_code?: string; // Code de transaction
  merchant_code?: string; // Code marchand
  event?: {
    id?: string;
    type?: string;
    timestamp?: string;
    checkout_id?: string;
    checkout_reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
    payment_type?: string;
    transaction_code?: string;
  };
}

