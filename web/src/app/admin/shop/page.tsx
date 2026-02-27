'use client';

import Link from 'next/link';

export default function AdminShopPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestão da Loja</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/shop/orders"
          className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]"
        >
          <div className="mb-2 text-3xl">📦</div>
          <h2 className="mb-1 text-lg font-medium">Encomendas</h2>
          <p className="text-sm text-white/50">
            Gerir encomendas e estados de pagamento
          </p>
        </Link>

        <Link
          href="/admin/shop/products"
          className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]"
        >
          <div className="mb-2 text-3xl">🛍️</div>
          <h2 className="mb-1 text-lg font-medium">Produtos</h2>
          <p className="text-sm text-white/50">
            Adicionar, editar e remover produtos
          </p>
        </Link>

        <Link
          href="/admin/shop/categories"
          className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]"
        >
          <div className="mb-2 text-3xl">🏷️</div>
          <h2 className="mb-1 text-lg font-medium">Categorias</h2>
          <p className="text-sm text-white/50">
            Organizar produtos por categorias
          </p>
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="mb-4 text-lg font-medium">Estatísticas Rápidas</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-white/50">Encomendas Pendentes</p>
            <p className="text-2xl font-bold">-</p>
          </div>
          <div>
            <p className="text-sm text-white/50">Produtos Ativos</p>
            <p className="text-2xl font-bold">-</p>
          </div>
          <div>
            <p className="text-sm text-white/50">Receita Total</p>
            <p className="text-2xl font-bold">-</p>
          </div>
        </div>
      </div>
    </div>
  );
}
