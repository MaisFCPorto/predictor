'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Order = {
  id: string;
  user_id: string;
  status: string;
  total: number;
  created_at: string;
  shipping_address: string;
  shipping_city: string;
  shop_order_items: Array<{
    id: string;
    quantity: number;
    price: number;
    shop_products: {
      name: string;
      image_url: string;
    };
  }>;
  shop_payments: Array<{
    id: string;
    status: string;
    method: string;
  }>;
};

export default function OrdersManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const shopApiUrl = process.env.NEXT_PUBLIC_SHOP_API_URL || 'https://predictor-shop-api.maisfcp.workers.dev';
      const res = await fetch(`${shopApiUrl}/shop/orders`);
      
      if (!res.ok) throw new Error('Failed to fetch orders');
      
      const data = await res.json();
      setOrders(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const shopApiUrl = process.env.NEXT_PUBLIC_SHOP_API_URL || 'https://predictor-shop-api.maisfcp.workers.dev';
      const res = await fetch(`${shopApiUrl}/shop/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update order');
      
      await fetchOrders();
    } catch (e: any) {
      alert('Erro ao atualizar encomenda: ' + e.message);
    }
  };

  const checkPaymentStatus = async (order: Order) => {
    if (!order.shop_payments.length) {
      alert('Sem pagamento associado');
      return;
    }

    const paymentId = order.shop_payments[0].id;
    
    try {
      const shopApiUrl = process.env.NEXT_PUBLIC_SHOP_API_URL || 'https://predictor-shop-api.maisfcp.workers.dev';
      const res = await fetch(`${shopApiUrl}/shop/payments/${paymentId}/status`);
      
      if (!res.ok) throw new Error('Failed to check payment status');
      
      const status = await res.json();
      alert(`Estado do pagamento: ${status.status}\n${status.message || ''}`);
      
      // Refresh orders to show updated status
      await fetchOrders();
    } catch (e: any) {
      alert('Erro ao verificar pagamento: ' + e.message);
    }
  };

  const checkAllPayments = async () => {
    const pendingOrders = orders.filter(
      o => o.shop_payments.length > 0 && 
           (o.status === 'pending' || o.shop_payments[0].status === 'pending')
    );

    if (pendingOrders.length === 0) {
      alert('Não há pagamentos pendentes para verificar');
      return;
    }

    if (!confirm(`Verificar ${pendingOrders.length} pagamento(s) pendente(s)?`)) {
      return;
    }

    setLoading(true);
    let updated = 0;
    let failed = 0;

    for (const order of pendingOrders) {
      const paymentId = order.shop_payments[0].id;
      
      try {
        const shopApiUrl = process.env.NEXT_PUBLIC_SHOP_API_URL || 'https://predictor-shop-api.maisfcp.workers.dev';
        const res = await fetch(`${shopApiUrl}/shop/payments/${paymentId}/status`);
        
        if (res.ok) {
          const status = await res.json();
          if (status.status === 'paid') {
            updated++;
          }
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    await fetchOrders();
    setLoading(false);
    
    alert(`Verificação concluída:\n✓ ${updated} pagamento(s) atualizado(s)\n${failed > 0 ? `✗ ${failed} erro(s)` : ''}`);
  };

  if (loading) {
    return <div className="p-6 text-white/70">A carregar encomendas...</div>;
  }

  if (error) {
    return <div className="p-6 text-rose-400">Erro: {error}</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-emerald-400';
      case 'processing': return 'text-blue-400';
      case 'shipped': return 'text-purple-400';
      case 'delivered': return 'text-green-400';
      case 'cancelled': return 'text-rose-400';
      default: return 'text-white/50';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-emerald-400';
      case 'pending': return 'text-amber-400';
      case 'failed': return 'text-rose-400';
      default: return 'text-white/50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestão de Encomendas</h1>
        <div className="flex gap-2">
          <button
            onClick={checkAllPayments}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm hover:bg-blue-700"
          >
            Verificar Todos os Pagamentos
          </button>
          <Link
            href="/admin/shop"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Voltar
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/50">
            Nenhuma encomenda encontrada
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-sm text-white/50">
                    Encomenda #{order.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-white/40">
                    {new Date(order.created_at).toLocaleString('pt-PT')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-medium">
                    {(order.total / 100).toLocaleString('pt-PT', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </p>
                  <p className={`text-sm ${getStatusColor(order.status)}`}>
                    {order.status}
                  </p>
                </div>
              </div>

              <div className="mb-4 space-y-2 border-t border-white/10 pt-4">
                <p className="text-sm">
                  <span className="text-white/50">Morada:</span>{' '}
                  {order.shipping_address}, {order.shipping_city}
                </p>
                {order.shop_payments.length > 0 && (
                  <p className="text-sm">
                    <span className="text-white/50">Pagamento:</span>{' '}
                    <span className={getPaymentStatusColor(order.shop_payments[0].status)}>
                      {order.shop_payments[0].method} - {order.shop_payments[0].status}
                    </span>
                  </p>
                )}
              </div>

              <div className="mb-4 space-y-2">
                <p className="text-sm font-medium text-white/70">Produtos:</p>
                {order.shop_order_items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 text-sm">
                    <span className="text-white/50">{item.quantity}x</span>
                    <span>{item.shop_products.name}</span>
                    <span className="text-white/50">
                      {(item.price / 100).toLocaleString('pt-PT', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <select
                  value={order.status}
                  onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="processing">Em Processamento</option>
                  <option value="shipped">Enviado</option>
                  <option value="delivered">Entregue</option>
                  <option value="cancelled">Cancelado</option>
                </select>
                {order.shop_payments.length > 0 && (
                  <button
                    onClick={() => checkPaymentStatus(order)}
                    className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/20"
                    title="Verificar estado do pagamento no EuPago"
                  >
                    Verificar Pagamento
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
