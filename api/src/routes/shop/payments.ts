import { Hono } from 'hono';
import { Env } from '../../types';
import { nanoid } from 'nanoid';
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

  // Get order details
  const { results: orders } = await c.env.DB
    .prepare('SELECT * FROM shop_orders WHERE id = ?')
    .bind(orderId)
    .all<{ id: string; total: number; user_id: string }>();

  const order = orders[0];
  if (!order) {
    return c.json({ error: 'order not found' }, 404);
  }

  // Get user details
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
  const paymentId = nanoid();

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
    await c.env.DB
      .prepare(`
        INSERT INTO shop_payments (
          id, order_id, method, amount, status,
          eupago_payment_id, entity, reference, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        paymentId,
        orderId,
        method,
        order.total,
        'pending',
        eupagoResponse.id,
        method === 'multibanco' ? (eupagoResponse as any).payment.entity : null,
        (eupagoResponse as any).payment.reference,
        new Date(eupagoResponse.payment.expiryDate),
      )
      .run();

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

  const { results } = await c.env.DB
    .prepare('SELECT * FROM shop_payments WHERE id = ?')
    .bind(id)
    .all<{
      id: string;
      order_id: string;
      method: string;
      amount: number;
      status: string;
      eupago_payment_id: string;
      entity: string | null;
      reference: string;
      expires_at: string;
      paid_at: string | null;
    }>();

  const payment = results[0];
  if (!payment) {
    return c.json({ error: 'payment not found' }, 404);
  }

  try {
    const eupago = new EuPagoService(c.env);
    const status = await eupago.getPaymentStatus(payment.eupago_payment_id);

    // Update payment status if changed
    if (status.status !== payment.status) {
      await c.env.DB
        .prepare('UPDATE shop_payments SET status = ?, paid_at = ? WHERE id = ?')
        .bind(
          status.status,
          status.payment.paidDate ? new Date(status.payment.paidDate) : null,
          id,
        )
        .run();

      // If payment is confirmed, update order status
      if (status.status === 'paid') {
        await c.env.DB
          .prepare('UPDATE shop_orders SET status = ? WHERE id = ?')
          .bind('paid', payment.order_id)
          .run();
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
    // Update payment status
    const { results } = await c.env.DB
      .prepare('SELECT * FROM shop_payments WHERE eupago_payment_id = ?')
      .bind(payment_id)
      .all();

    const payment = results[0];
    if (!payment) {
      return c.json({ error: 'payment not found' }, 404);
    }

    await c.env.DB
      .prepare('UPDATE shop_payments SET status = ?, paid_at = ? WHERE id = ?')
      .bind(status, paid_date ? new Date(paid_date) : null, payment.id)
      .run();

    // If payment is confirmed, update order status
    if (status === 'paid') {
      await c.env.DB
        .prepare('UPDATE shop_orders SET status = ? WHERE id = ?')
        .bind('paid', payment.order_id)
        .run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'webhook processing failed' }, 500);
  }
});
