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
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
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

