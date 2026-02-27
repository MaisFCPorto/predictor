import { Hono } from 'hono';
import { Env } from '../../types';
import { ShopSupabaseService } from '../../services/supabase-shop';
import { EuPagoService } from '../../services/eupago';

export const payments = new Hono<{ Bindings: Env }>();

// Handle CORS preflight
payments.options('*', (c) => c.body(null, 204));

// Create a new payment for an order
payments.post('/', async (c) => {
  const { orderId, method, phone } = await c.req.json();
  if (!orderId || !method) {
    return c.json({ error: 'missing required fields' }, 400);
  }

  const shopService = new ShopSupabaseService(c.env);
  
  // Get order details
  console.log('Fetching order:', orderId);
  const order = await shopService.getOrder(orderId);
  if (!order) {
    return c.json({ error: 'order not found' }, 404);
  }
  console.log('Order found:', { id: order.id, total: order.total });

  // Initialize EuPago service
  const eupago = new EuPagoService(c.env);
  const paymentId = crypto.randomUUID();

  try {
    let eupagoResponse;
    
    console.log('Creating payment with method:', method);
    if (method === 'multibanco') {
      eupagoResponse = await eupago.createMultibanco({
        payment: {
          amount: order.total / 100, // Convert cents to euros
          currency: 'EUR',
          expiryDays: 3,
        },
        customer: {
          name: 'Cliente FC Porto',
          email: 'cliente@fcpporto.pt',
        },
      });
    } else if (method === 'mbway') {
      if (!phone) {
        return c.json({ error: 'phone required for MB WAY' }, 400);
      }

      eupagoResponse = await eupago.createMBWay({
        payment: {
          amount: order.total / 100, // Convert cents to euros
          currency: 'EUR',
          expiry: 30, // 30 minutes
        },
        customer: {
          name: 'Cliente FC Porto',
          email: 'cliente@fcpporto.pt',
          phone,
        },
      });
    } else {
      return c.json({ error: 'unsupported payment method' }, 400);
    }

    console.log('Raw EuPago response:', JSON.stringify(eupagoResponse, null, 2));

    // Calculate expiry date
    let expiresAt: string;
    if (method === 'multibanco' && (eupagoResponse as any).data_fim) {
      // Multibanco: use data_fim from response (format: YYYY-MM-DD)
      const dataFim = (eupagoResponse as any).data_fim;
      expiresAt = new Date(dataFim + 'T23:59:59Z').toISOString();
    } else {
      // MB WAY or fallback: 30 minutes from now
      expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    }

    // Build response details
    const responseDetails = method === 'multibanco' 
      ? {
          entity: (eupagoResponse as any).entidade,
          reference: eupagoResponse.referencia,
          value: eupagoResponse.valor,
          expiryDate: (eupagoResponse as any).data_fim,
        }
      : {
          reference: eupagoResponse.referencia,
          value: eupagoResponse.valor,
          alias: (eupagoResponse as any).alias,
        };
    
    console.log('Response details being sent:', JSON.stringify(responseDetails, null, 2));

    // Save payment details
    // Store the identificador (TRID) as the eupago_payment_id for status checks
    await shopService.createPayment({
      id: paymentId,
      order_id: orderId,
      method,
      amount: order.total,
      status: 'pending',
      eupago_payment_id: (eupagoResponse as any).identificador || eupagoResponse.referencia, // Use TRID if available
      entity: method === 'multibanco' ? (eupagoResponse as any).entidade : undefined,
      reference: eupagoResponse.referencia,
      expires_at: expiresAt,
    });

    return c.json({
      id: paymentId,
      method,
      amount: order.total,
      details: responseDetails,
    });
  } catch (error) {
    console.error('EuPago payment error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return c.json({ 
      error: 'payment creation failed',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Get payment status
payments.get('/:id/status', async (c) => {
  const { id } = c.req.param();

  const shopService = new ShopSupabaseService(c.env);
  
  try {
    const payment = await shopService.getPayment(id);
    if (!payment) {
      return c.json({ error: 'payment not found' }, 404);
    }

    const eupago = new EuPagoService(c.env);
    const eupagoStatus = await eupago.getPaymentStatus(payment.eupago_payment_id);

    // Map EuPago status to our status
    const isPaid = eupagoStatus.estado_referencia === 'paga';
    const newStatus = isPaid ? 'paid' : 'pending';

    // Update payment status if changed
    if (newStatus !== payment.status) {
      await shopService.updatePaymentStatus(
        id,
        newStatus,
        eupagoStatus.data_pagamento
      );

      // If payment is confirmed, update order status
      if (isPaid) {
        await shopService.updateOrderStatus(payment.order_id, 'paid');
      }
    }

    return c.json({
      status: newStatus,
      message: eupagoStatus.resposta,
      reference: eupagoStatus.referencia,
      paid: isPaid,
      paidDate: eupagoStatus.data_pagamento,
    });
  } catch (error) {
    console.error('EuPago status error:', error);
    return c.json({ error: 'failed to get payment status' }, 500);
  }
});

// Webhook for payment notifications
payments.post('/webhook', async (c) => {
  // Verify webhook signature
  const signature = c.req.header('X-EuPago-Signature');
  if (!signature || signature !== c.env.EUPAGO_WEBHOOK_SECRET) {
    return c.json({ error: 'invalid signature' }, 401);
  }

  const data = await c.req.json();
  const { payment_id, status, paid_date } = data;

  try {
    const shopService = new ShopSupabaseService(c.env);
    
    // Get payment by EuPago ID
    const payment = await shopService.getPaymentByEuPagoId(payment_id);
    if (!payment) {
      return c.json({ error: 'payment not found' }, 404);
    }

    // Update payment status
    await shopService.updatePaymentStatus(
      payment.id,
      status,
      paid_date
    );

    // If payment is confirmed, update order status
    if (status === 'paid') {
      await shopService.updateOrderStatus(payment.order_id, 'paid');
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'webhook processing failed' }, 500);
  }
});
