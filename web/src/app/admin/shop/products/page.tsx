'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  category: string;
  created_at: string;
};

export default function ProductsManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const shopApiUrl = process.env.NEXT_PUBLIC_SHOP_API_URL || 'https://predictor-shop-api.maisfcp.workers.dev';
      const res = await fetch(`${shopApiUrl}/shop/products`);
      
      if (!res.ok) throw new Error('Failed to fetch products');
      
      const data = await res.json();
      setProducts(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const productData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      price: Math.round(parseFloat(formData.get('price') as string) * 100),
      stock: parseInt(formData.get('stock') as string),
      image_url: formData.get('image_url') as string,
      category: formData.get('category') as string,
    };

    try {
      const shopApiUrl = process.env.NEXT_PUBLIC_SHOP_API_URL || 'https://predictor-shop-api.maisfcp.workers.dev';
      const url = editingProduct 
        ? `${shopApiUrl}/shop/products/${editingProduct.id}`
        : `${shopApiUrl}/shop/products`;
      
      const res = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (!res.ok) throw new Error('Failed to save product');
      
      await fetchProducts();
      setShowForm(false);
      setEditingProduct(null);
    } catch (e: any) {
      alert('Erro ao guardar produto: ' + e.message);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Tem a certeza que deseja eliminar este produto?')) return;

    try {
      const shopApiUrl = process.env.NEXT_PUBLIC_SHOP_API_URL || 'https://predictor-shop-api.maisfcp.workers.dev';
      const res = await fetch(`${shopApiUrl}/shop/products/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete product');
      
      await fetchProducts();
    } catch (e: any) {
      alert('Erro ao eliminar produto: ' + e.message);
    }
  };

  if (loading) {
    return <div className="p-6 text-white/70">A carregar produtos...</div>;
  }

  if (error) {
    return <div className="p-6 text-rose-400">Erro: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestão de Produtos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowForm(!showForm);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm hover:bg-blue-700"
          >
            {showForm ? 'Cancelar' : 'Adicionar Produto'}
          </button>
          <Link
            href="/admin/shop"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Voltar
          </Link>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-lg font-medium">
            {editingProduct ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-white/70">Nome</label>
              <input
                type="text"
                name="name"
                defaultValue={editingProduct?.name}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Categoria</label>
              <input
                type="text"
                name="category"
                defaultValue={editingProduct?.category}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Preço (€)</label>
              <input
                type="number"
                name="price"
                step="0.01"
                defaultValue={editingProduct ? editingProduct.price / 100 : ''}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Stock</label>
              <input
                type="number"
                name="stock"
                defaultValue={editingProduct?.stock}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-white/70">URL da Imagem</label>
              <input
                type="url"
                name="image_url"
                defaultValue={editingProduct?.image_url}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-white/70">Descrição</label>
              <textarea
                name="description"
                defaultValue={editingProduct?.description}
                required
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm hover:bg-blue-700"
            >
              {editingProduct ? 'Atualizar' : 'Criar'} Produto
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.length === 0 ? (
          <div className="col-span-full rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/50">
            Nenhum produto encontrado
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <img
                src={product.image_url}
                alt={product.name}
                className="mb-3 h-40 w-full rounded-lg object-cover"
              />
              <h3 className="mb-1 font-medium">{product.name}</h3>
              <p className="mb-2 text-sm text-white/50 line-clamp-2">
                {product.description}
              </p>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium">
                  {(product.price / 100).toLocaleString('pt-PT', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </span>
                <span className="text-white/50">Stock: {product.stock}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingProduct(product);
                    setShowForm(true);
                  }}
                  className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
                >
                  Editar
                </button>
                <button
                  onClick={() => deleteProduct(product.id)}
                  className="flex-1 rounded-lg bg-rose-600/20 px-3 py-1.5 text-sm text-rose-400 hover:bg-rose-600/30"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
