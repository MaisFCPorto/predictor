import { Env } from './types';
import { ShopSupabaseService } from './services/supabase-shop';
import { EuPagoService } from './services/eupago';

export async function checkPendingPayments(env: Env) {
  console.log('Running scheduled payment check...');
  
  const shopService = new ShopSupabaseService(env);
  const eupago = new EuPagoService(env);
  
  try {
    // Get all orders with pending payments
    const orders = await shopService.listOrders();
    const pendingOrders = orders.filter(
      (o: any) => o.shop_payments?.length > 0 && 
                  (o.status === 'pending' || o.shop_payments[0].status === 'pending')
    );

    console.log(`Found ${pendingOrders.length} pending orders to check`);

    let updated = 0;
    
    for (const order of pendingOrders) {
      const payment = order.shop_payments[0];
      
      try {
        // Check payment status with EuPago
        const eupagoStatus = await eupago.getPaymentStatus(payment.reference);
        
        const isPaid = eupagoStatus.estado_referencia === 'paga';
        
        if (isPaid && payment.status !== 'paid') {
          // Update payment status
          await shopService.updatePaymentStatus(
            payment.id,
            'paid',
            eupagoStatus.data_pagamento
          );
          
          // Update order status
          await shopService.updateOrderStatus(order.id, 'paid');
          
          updated++;
          console.log(`✓ Payment confirmed for order ${order.id}`);
        }
      } catch (error) {
        console.error(`Error checking payment for order ${order.id}:`, error);
      }
    }

    console.log(`Payment check complete. Updated ${updated} payment(s).`);
    return { success: true, checked: pendingOrders.length, updated };
  } catch (error) {
    console.error('Error in scheduled payment check:', error);
    return { success: false, error: String(error) };
  }
}
