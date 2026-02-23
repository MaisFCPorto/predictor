'use client';

import { useCart } from '@/components/CartContext';
import { CartSlideOver } from '@/components/CartSlideOver';
import AdminGate from '../admin/_components/AdminGate';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
};

const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Camisola Champions \'87',
    description: 'Camisola comemorativa da Taça dos Campeões Europeus de 1987.',
    price: 8700, // 87.00€
    imageUrl: '/win-icons-01.svg',
    stock: 10,
  },
  {
    id: '2',
    name: 'Cachecol +FCPorto',
    description: 'Cachecol oficial do +FCPorto, perfeito para mostrar o teu apoio.',
    price: 1500, // 15.00€
    imageUrl: '/win-icons-03.svg',
    stock: 50,
  },
  {
    id: '3',
    name: 'Pack Sócio Premium',
    description: 'Acesso exclusivo a conteúdos premium e descontos especiais.',
    price: 2999, // 29.99€
    imageUrl: '/win-icons-02.svg',
    stock: 100,
  },
];

function ShopInner() {
  const { addItem } = useCart();

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
          {PRODUCTS.map((product) => (
            <div
              key={product.id}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="aspect-w-1 aspect-h-1 mb-6 overflow-hidden rounded-xl bg-black/20">
                <img
                  src={product.imageUrl}
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
                    imageUrl: product.imageUrl,
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
