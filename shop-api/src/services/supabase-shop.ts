import { createClient } from '@supabase/supabase-js';

export class ShopSupabaseService {
  private client: any;

  constructor(env: any) {
    this.client = createClient(
      env.SHOP_SUPABASE_URL,
      env.SHOP_SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  async createOrder(orderData: {
    id: string;
    user_id: string;
    status: string;
    total: number;
    shipping_address: string;
    shipping_city: string;
    shipping_postal_code: string;
    shipping_country: string;
  }) {
    const { data, error } = await this.client
      .from('shop_orders')
      .insert(orderData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createOrderItems(items: Array<{
    id: string;
    order_id: string;
    product_id: string;
    quantity: number;
    price: number;
  }>) {
    const { data, error } = await this.client
      .from('shop_order_items')
      .insert(items)
      .select();

    if (error) throw error;
    return data;
  }

  async updateProductStock(productId: string, quantity: number) {
    // First get current stock
    const { data: product, error: fetchError } = await this.client
      .from('shop_products')
      .select('stock')
      .eq('id', productId)
      .single();

    if (fetchError) throw fetchError;

    // Then update with new stock
    const newStock = Math.max(0, product.stock - quantity);
    const { data, error } = await this.client
      .from('shop_products')
      .update({ stock: newStock })
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createPayment(paymentData: {
    id: string;
    order_id: string;
    method: string;
    amount: number;
    status: string;
    eupago_payment_id: string;
    entity?: string;
    reference: string;
    expires_at: string;
  }) {
    const { data, error } = await this.client
      .from('shop_payments')
      .insert(paymentData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getPayment(id: string) {
    const { data, error } = await this.client
      .from('shop_payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async updatePaymentStatus(id: string, status: string, paidAt?: string) {
    const updateData: any = { status };
    if (paidAt) {
      updateData.paid_at = paidAt;
    }

    const { data, error } = await this.client
      .from('shop_payments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateOrderStatus(orderId: string, status: string) {
    const { data, error } = await this.client
      .from('shop_orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getOrder(id: string) {
    const { data, error } = await this.client
      .from('shop_orders')
      .select(`
        *,
        shop_order_items (
          *,
          shop_products (name, image_url)
        ),
        shop_payments (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async listOrders() {
    const { data, error } = await this.client
      .from('shop_orders')
      .select(`
        *,
        shop_order_items (id),
        shop_payments (status)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getPaymentByEuPagoId(eupagoPaymentId: string) {
    const { data, error } = await this.client
      .from('shop_payments')
      .select('*')
      .eq('eupago_payment_id', eupagoPaymentId)
      .single();

    if (error) throw error;
    return data;
  }

  async listProducts() {
    const { data, error } = await this.client
      .from('shop_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}
