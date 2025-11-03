// apps/web/src/app/layout.tsx
import './globals.css';
import Link from 'next/link';
//import { cn } from '@/utils/cn'; // opcional: helper classnames

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-[#0a1e7a] bg-no-repeat bg-cover bg-fixed bg-center text-white ">
        <header className="nav-glass  sticky top-0 z-50">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 bg-no-repeat bg-cover bg-fixed">
            <Link href="/" className="font-semibold tracking-tight">
              +Predictor
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/jogos" className="hover:text-white/90">Jogos</Link>
              <Link href="/rankings" className="hover:text-white/90">Rankings</Link>
              <Link href="/premios" className="hover:text-white/90">Prémios</Link>
              <Link href="/regras" className="hover:text-white/90">Regras</Link>
            </nav>
          </div>
        </header>
        <main className=" mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
