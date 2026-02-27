export interface Env {
  ADMIN_KEY: string;
  SUPABASE_URL: string;
  SHOP_SUPABASE_URL: string;
  SHOP_SUPABASE_SERVICE_KEY: string;
  EUPAGO_API_KEY: string;
  EUPAGO_API_URL?: string;
  EUPAGO_WEBHOOK_SECRET: string;
}

export type PaymentMethod = 'multibanco' | 'mbway' | 'credit_card' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
