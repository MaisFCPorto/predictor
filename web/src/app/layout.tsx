// apps/web/src/app/layout.tsx
import './globals.css';
import Link from 'next/link';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-[url('/bg.svg')] bg-no-repeat bg-cover bg-fixed bg-center text-white">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(10,16,30,0.45)] backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
            <Link href="/" className="font-semibold tracking-tight hover:opacity-90">
              Predictor
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/jogos" className="hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-sky-400/60 rounded">
                Jogos
              </Link>
              <Link href="/rankings" className="hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-sky-400/60 rounded">
                Rankings
              </Link>
              <Link href="/premios" className="hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-sky-400/60 rounded">
                Prémios
              </Link>
              <Link href="/regras" className="hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-sky-400/60 rounded">
                Regras
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
