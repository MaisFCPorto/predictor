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
  const order = await shopService.getOrder(orderId);
  if (!order) {
    return c.json({ error: 'order not found' }, 404);
  }

  // Get user details from main database
  const { results: users } = await c.env.DB
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(order.user_id)
    .all<{ email: string; name: string }>();

  const user = users[0];
  if (!user) {
    return c.json({ error: 'user not found' }, 404);
  }

  // Initialize EuPago service
  const eupago = new EuPagoService(c.env);
  const paymentId = crypto.randomUUID();

  try {
    let eupagoResponse;
    
    if (method === 'multibanco') {
      eupagoResponse = await eupago.createMultibanco({
        payment: {
          amount: order.total / 100, // Convert cents to euros
          currency: 'EUR',
          expiryDays: 3,
        },
        customer: {
          name: user.name,
          email: user.email,
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
          name: user.name,
          email: user.email,
          phone,
        },
      });
    } else {
      return c.json({ error: 'unsupported payment method' }, 400);
    }

    // Save payment details
    await shopService.createPayment({
      id: paymentId,
      order_id: orderId,
      method,
      amount: order.total,
      status: 'pending',
      eupago_payment_id: eupagoResponse.id,
      entity: method === 'multibanco' ? (eupagoResponse as any).payment.entity : undefined,
      reference: (eupagoResponse as any).payment.reference,
      expires_at: new Date(eupagoResponse.payment.expiryDate).toISOString(),
    });

    return c.json({
      id: paymentId,
      method,
      amount: order.total,
      details: eupagoResponse.payment,
    });
  } catch (error) {
    console.error('EuPago payment error:', error);
    return c.json({ error: 'payment creation failed' }, 500);
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
    const status = await eupago.getPaymentStatus(payment.eupago_payment_id);

    // Update payment status if changed
    if (status.status !== payment.status) {
      await shopService.updatePaymentStatus(
        id,
        status.status,
        status.payment.paidDate
      );

      // If payment is confirmed, update order status
      if (status.status === 'paid') {
        await shopService.updateOrderStatus(payment.order_id, 'paid');
      }
    }

    return c.json(status);
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
