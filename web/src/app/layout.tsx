import './globals.css';
import Link from 'next/link';
import Image from 'next/image';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-[#0a1e7a] bg-no-repeat bg-cover bg-fixed bg-center text-white">
        <header className="nav-glass sticky top-0 z-50">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 bg-no-repeat bg-cover bg-fixed">
            {/* LOGO */}
            <Link href="/jogos" className="flex items-center gap-2">
              <Image
                src="/logos/predictor-03.svg"
                alt="Predictor"
                width={120}
                height={32}
                priority
                className="h-6 w-auto sm:h-7 md:h-8"
              />
            </Link>

            {/* NAV */}
            <nav className="flex gap-6 text-sm">
              <Link href="/rankings" className="hover:text-white/90 transition-colors">
                Rankings
              </Link>
              <Link href="/premios" className="hover:text-white/90 transition-colors">
                Prémios
              </Link>
              <Link href="/regras" className="hover:text-white/90 transition-colors">
                Regras
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4">{children}</main>

        <footer className="mt-10 border-t border-white/10">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs leading-relaxed text-white/70 text-center">
            <div className="opacity-80">© {new Date().getFullYear()} +FCPorto Predictor. Todos os direitos reservados.</div>
            <div className="mt-1">
              As marcas, nomes e logótipos do +FCPorto e da Betano são propriedade dos respetivos titulares e estão protegidos por direitos de autor e/ou marcas registadas. Não é permitida a utilização para fins comerciais sem autorização.
            </div>
            <div className="mt-1">
              A utilização deste site implica a aceitação dos{' '}
              <Link href="/regras" className="underline underline-offset-2 hover:text-white/90">
                Termos e Condições
              </Link>{' '}deste projeto.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
