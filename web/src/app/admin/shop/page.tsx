// 'use client';

// import { useCallback, useEffect, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import Link from 'next/link';
// import { notify } from '@/components/notifications';
// import { adm } from '@/utils/api';
// import { errorMessage } from '@/utils/errors';

// type Product = {
//   id: number;
//   name: string;
//   description: string | null;
//   price: number;
//   stock: number;
//   image_url: string | null;
//   active: boolean;
//   category_id: number | null;
//   category_name: string | null;
// };

// type Category = {
//   id: number;
//   name: string;
//   description: string | null;
// };

// export default function AdminShopPage() {
//   const [products, setProducts] = useState<Product[]>([]);
//   const [categories, setCategories] = useState<Category[]>([]);
//   const [loading, setLoading] = useState(true);
//   const router = useRouter();

//   const loadData = useCallback(async () => {
//     try {
//       const [productsRes, categoriesRes] = await Promise.all([
//         adm.get('/api/admin/shop/products'),
//         adm.get('/api/admin/shop/categories'),
//       ]);

//       setProducts(productsRes.data ?? []);
//       setCategories(categoriesRes.data ?? []);
//     } catch (e) {
//       console.error('Failed to load shop data:', e);
//       notify('Erro ao carregar dados da loja ❌');
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadData();
//   }, [loadData]);

//   async function toggleProductStatus(product: Product) {
//     try {
//       await adm.patch(`/api/admin/shop/products/${product.id}`, {
//         active: !product.active,
//       });
//       notify(
//         product.active
//           ? 'Produto desativado ✅'
//           : 'Produto ativado ✅'
//       );
//       await loadData();
//     } catch (e) {
//       alert(errorMessage(e));
//     }
//   }

//   if (loading) {
//     return (
//       <div className="p-6 opacity-70">
//         A carregar dados da loja...
//       </div>
//     );
//   }

//   return (
//     <div className="p-6 max-w-6xl mx-auto">
//       <div className="flex items-center justify-between mb-8">
//         <div className="flex items-center gap-4">
//           <h1 className="text-2xl font-semibold">Loja</h1>
//           <Link
//             href="/admin/shop/orders"
//             className="text-sm px-3 py-1 rounded-full bg-white/10 hover:bg-white/15"
//           >
//             Ver Encomendas
//           </Link>
//         </div>
//         <button
//           onClick={() => router.push('/admin/shop/new')}
//           className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-4 py-2 rounded-full"
//         >
//           <div className="w-4 h-4" />
//           <span>Novo Produto</span>
//         </button>
//       </div>

//       <div className="space-y-8">
//         <section>
//           <h2 className="text-lg font-medium mb-4">Categorias</h2>
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {categories.map((category) => (
//               <div
//                 key={category.id}
//                 className="p-4 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
//                 onClick={() => router.push(`/admin/shop/categories/${category.id}`)}
//               >
//                 <h3 className="font-medium">{category.name}</h3>
//                 {category.description && (
//                   <p className="mt-1 text-sm opacity-70">{category.description}</p>
//                 )}
//               </div>
//             ))}
//             <button
//               onClick={() => router.push('/admin/shop/categories/new')}
//               className="p-4 rounded-lg border border-dashed border-white/20 hover:border-white/40 flex items-center justify-center gap-2"
//             >
//               <div className="w-4 h-4" />
//               <span>Nova Categoria</span>
//             </button>
//           </div>
//         </section>

//         <section>
//           <h2 className="text-lg font-medium mb-4">Produtos</h2>
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {products.map((product) => (
//               <div
//                 key={product.id}
//                 className="relative p-4 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer group"
//                 onClick={() => router.push(`/admin/shop/products/${product.id}`)}
//               >
//                 {product.image_url && (
//                   <img
//                     src={product.image_url}
//                     alt={product.name}
//                     className="w-full h-48 object-cover rounded-md mb-4"
//                   />
//                 )}
//                 <h3 className="font-medium">{product.name}</h3>
//                 {product.description && (
//                   <p className="mt-1 text-sm opacity-70">{product.description}</p>
//                 )}
//                 <div className="mt-2 flex items-center justify-between">
//                   <span className="font-medium">
//                     {(product.price / 100).toLocaleString('pt-PT', {
//                       style: 'currency',
//                       currency: 'EUR',
//                     })}
//                   </span>
//                   <span className={product.stock > 0 ? 'text-green-400' : 'text-red-400'}>
//                     {product.stock} em stock
//                   </span>
//                 </div>
//                 {product.category_name && (
//                   <span className="absolute top-2 right-2 px-2 py-1 text-xs rounded-full bg-white/10">
//                     {product.category_name}
//                   </span>
//                 )}
//                 <button
//                   onClick={(e) => {
//                     e.stopPropagation();
//                     toggleProductStatus(product);
//                   }}
//                   className={`absolute bottom-2 right-2 px-2 py-1 text-xs rounded-full ${
//                     product.active
//                       ? 'bg-green-500/20 text-green-300'
//                       : 'bg-red-500/20 text-red-300'
//                   } opacity-0 group-hover:opacity-100 transition-opacity`}
//                 >
//                   {product.active ? 'Ativo' : 'Inativo'}
//                 </button>
//               </div>
//             ))}
//             <button
//               onClick={() => router.push('/admin/shop/products/new')}
//               className="p-4 rounded-lg border border-dashed border-white/20 hover:border-white/40 flex items-center justify-center gap-2"
//             >
//               <div className="w-4 h-4" />
//               <span>Novo Produto</span>
//             </button>
//           </div>
//         </section>
//       </div>
//     </div>
//   );
// }
