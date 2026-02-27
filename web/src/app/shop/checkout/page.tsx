'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePKCE } from '@/utils/supabase/client';
import { useCart } from '@/components/CartContext';
import AdminGate from '../../admin/_components/AdminGate';

type CheckoutFormData = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  paymentMethod: 'multibanco' | 'mbway';
};

function CheckoutInner() {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const [formData, setFormData] = useState<CheckoutFormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    paymentMethod: 'multibanco',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-white/70">O carrinho está vazio.</p>
        <button
          onClick={() => router.push('/shop')}
          className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
        >
          Voltar à loja
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get auth token
      const { data: { session } } = await supabasePKCE.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      // 1. Create order
      const shopApiUrl = process.env.NEXT_PUBLIC_SHOP_API_URL || 'https://predictor-shop-api.maisfcp.workers.dev';
      console.log('Using shop API URL:', shopApiUrl);
      const orderRes = await fetch(`${shopApiUrl}/shop/orders`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          items,
          total,
          shipping: {
            name: formData.name,
            address: formData.address,
            city: formData.city,
            postalCode: formData.postalCode,
            country: 'PT',
          },
        }),
      });

      if (!orderRes.ok) {
        throw new Error('Falha ao criar encomenda');
      }

      const order = await orderRes.json();

      // 2. Create payment
      const paymentRes = await fetch(`${shopApiUrl}/shop/payments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          method: formData.paymentMethod,
          phone: formData.phone, // for MB WAY
        }),
      });

      if (!paymentRes.ok) {
        throw new Error('Falha ao criar pagamento');
      }

      const payment = await paymentRes.json();
      setPaymentDetails(payment);
      clearCart(); // Clear cart after successful order
    } catch (e: any) {
      console.error('Checkout error:', e);
      setError(e?.message || 'Erro ao processar encomenda');
    } finally {
      setLoading(false);
    }
  };

  if (paymentDetails) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xl font-medium">Pagamento</h2>
          
          {paymentDetails.method === 'multibanco' && (
            <div className="space-y-4">
              <p className="text-sm text-white/70">
                Para concluir a sua compra, efetue o pagamento por Multibanco com os seguintes dados:
              </p>
              <div className="space-y-2 rounded-xl bg-white/[0.02] p-4 font-mono">
                <p>
                  <span className="text-white/50">Entidade:</span>{' '}
                  {paymentDetails.details.entity}
                </p>
                <p>
                  <span className="text-white/50">Referência:</span>{' '}
                  {paymentDetails.details.reference}
                </p>
                <p>
                  <span className="text-white/50">Valor:</span>{' '}
                  {(paymentDetails.amount / 100).toLocaleString('pt-PT', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </p>
              </div>
              <p className="text-xs text-white/50">
                O pagamento deve ser efetuado nas próximas 48 horas.
              </p>
            </div>
          )}

          {paymentDetails.method === 'mbway' && (
            <div className="space-y-4">
              <p className="text-sm text-white/70">
                Foi enviado um pedido de pagamento para o seu telemóvel. Por favor, aceite o pagamento na app MB WAY.
              </p>
              <div className="space-y-2 rounded-xl bg-white/[0.02] p-4">
                <p className="font-mono">
                  <span className="text-white/50">Valor:</span>{' '}
                  {(paymentDetails.amount / 100).toLocaleString('pt-PT', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </p>
              </div>
              <p className="text-xs text-white/50">
                O pagamento deve ser aceite nos próximos 5 minutos.
              </p>
            </div>
          )}

          <button
            onClick={() => router.push('/shop')}
            className="mt-6 w-full rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Voltar à loja
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xl font-medium">Dados de envio</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm text-white/70">
                Nome
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm text-white/70">
                Email
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1 block text-sm text-white/70">
                Telemóvel
              </label>
              <input
                type="tel"
                id="phone"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="address" className="mb-1 block text-sm text-white/70">
                Morada
              </label>
              <input
                type="text"
                id="address"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-sm"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="city" className="mb-1 block text-sm text-white/70">
                  Cidade
                </label>
                <input
                  type="text"
                  id="city"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="postalCode" className="mb-1 block text-sm text-white/70">
                  Código Postal
                </label>
                <input
                  type="text"
                  id="postalCode"
                  required
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xl font-medium">Método de pagamento</h2>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <input
                type="radio"
                name="paymentMethod"
                value="multibanco"
                checked={formData.paymentMethod === 'multibanco'}
                onChange={(e) =>
                  setFormData({ ...formData, paymentMethod: 'multibanco' as const })
                }
              />
              <div>
                <div className="font-medium">Multibanco</div>
                <div className="text-sm text-white/70">
                  Pague por referência Multibanco
                </div>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <input
                type="radio"
                name="paymentMethod"
                value="mbway"
                checked={formData.paymentMethod === 'mbway'}
                onChange={(e) =>
                  setFormData({ ...formData, paymentMethod: 'mbway' as const })
                }
              />
              <div>
                <div className="font-medium">MB WAY</div>
                <div className="text-sm text-white/70">
                  Pague diretamente no seu telemóvel
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xl font-medium">Resumo do pedido</h2>
          <div className="space-y-4">
            <ul className="divide-y divide-white/10">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-4">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-white/70">Quantidade: {item.quantity}</div>
                  </div>
                  <div className="text-right">
                    <div>
                      {((item.price * item.quantity) / 100).toLocaleString('pt-PT', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between font-medium">
                <span>Total</span>
                <span>
                  {(total / 100).toLocaleString('pt-PT', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-white/10 px-4 py-3 font-medium hover:bg-white/15 disabled:opacity-50"
        >
          {loading ? 'A processar...' : 'Finalizar compra'}
        </button>
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <AdminGate>
      <CheckoutInner />
    </AdminGate>
  );
}
