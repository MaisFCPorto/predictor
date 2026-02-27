'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/components/CartContext';
import { CartSlideOver } from '@/components/CartSlideOver';
import AdminGate from '@/app/admin/_components/AdminGate';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  category: string;
}

function ShopInner() {
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const shopApiUrl = process.env.NEXT_PUBLIC_SHOP_API_URL || 'https://predictor-shop-api.maisfcp.workers.dev';
        const response = await fetch(`${shopApiUrl}/shop/products`);
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">A carregar produtos...</div>
      </div>
    );
  }

  return (
    <div>
      <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
        <header className="mb-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-white/40">
            +Loja
          </p>
          <h1 className="mb-3 text-3xl font-bold">+FCPorto Store</h1>
          <p className="max-w-2xl text-sm text-white/70">
            Produtos exclusivos para verdadeiros +Portistas.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="aspect-w-1 aspect-h-1 mb-6 overflow-hidden rounded-xl bg-black/20">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              <h2 className="mb-2 text-lg font-medium">{product.name}</h2>
              <p className="mb-4 text-sm text-white/70">{product.description}</p>

              <div className="mt-auto flex items-center justify-between">
                <span className="text-lg font-medium">
                  {(product.price / 100).toLocaleString('pt-PT', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </span>

                <button
                  onClick={() => addItem({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    imageUrl: product.image_url,
                  })}
                  className="rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/15"
                >
                  Adicionar ao carrinho
                </button>
              </div>

              {product.stock < 10 && (
                <span className="absolute right-6 top-6 rounded-full bg-rose-500/20 px-2 py-1 text-xs font-medium text-rose-300">
                  Apenas {product.stock} em stock
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
          <p className="leading-relaxed mb-2">
            <span className="font-medium">Informações importantes:</span>
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>Todos os preços incluem IVA à taxa legal em vigor</li>
            <li>Entregas em 3-5 dias úteis para Portugal Continental</li>
            <li>Trocas e devoluções até 30 dias após a compra</li>
            <li>Pagamento seguro por MB Way, cartão de crédito ou transferência bancária</li>
          </ul>
        </div>
      </main>

      <CartSlideOver />
    </div>
  );
}

export default function ShopPage() {
  return (
    <AdminGate>
      <ShopInner />
    </AdminGate>
  );
}
