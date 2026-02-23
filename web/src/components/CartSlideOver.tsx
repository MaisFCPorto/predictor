'use client';

import { useCart } from './CartContext';

export function CartSlideOver() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, total } = useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-black/30 transition-opacity" 
          onClick={() => setIsOpen(false)}
        />

        {/* Panel */}
        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="pointer-events-auto w-screen max-w-md">
            <div className="flex h-full flex-col bg-gradient-to-b from-gray-900 to-black text-white shadow-xl">
              <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-medium">Carrinho de compras</h2>
                  <button
                    type="button"
                    className="relative -m-2 p-2 text-white/70 hover:text-white"
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="absolute -inset-0.5" />
                    <span className="sr-only">Fechar painel</span>
                    ✕
                  </button>
                </div>

                {/* Cart items */}
                <div className="mt-8">
                  <div className="flow-root">
                    <ul role="list" className="-my-6 divide-y divide-white/10">
                      {items.map((item) => (
                        <li key={item.id} className="flex py-6">
                          {item.imageUrl && (
                            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-white/10">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-cover object-center"
                              />
                            </div>
                          )}

                          <div className="ml-4 flex flex-1 flex-col">
                            <div>
                              <div className="flex justify-between text-base font-medium">
                                <h3>{item.name}</h3>
                                <p className="ml-4">
                                  {(item.price / 100).toLocaleString('pt-PT', {
                                    style: 'currency',
                                    currency: 'EUR',
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-1 items-end justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <label htmlFor={`quantity-${item.id}`} className="text-white/70">
                                  Qtd
                                </label>
                                <select
                                  id={`quantity-${item.id}`}
                                  value={item.quantity}
                                  onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                                  className="rounded bg-white/10 px-2 py-1"
                                >
                                  {[1, 2, 3, 4, 5].map((num) => (
                                    <option key={num} value={num}>
                                      {num}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="font-medium text-rose-400 hover:text-rose-300"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-white/10 px-4 py-6 sm:px-6">
                <div className="flex justify-between text-base font-medium">
                  <p>Total</p>
                  <p>
                    {(total / 100).toLocaleString('pt-PT', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-white/70">
                  Portes de envio calculados no checkout.
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center rounded-full bg-white/10 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-white/20"
                  >
                    Checkout
                  </button>
                </div>
                <div className="mt-6 flex justify-center text-center text-sm text-white/70">
                  <button
                    type="button"
                    className="font-medium hover:text-white"
                    onClick={() => setIsOpen(false)}
                  >
                    Continuar a comprar
                    <span aria-hidden="true"> →</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
