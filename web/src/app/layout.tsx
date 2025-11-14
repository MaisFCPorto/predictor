'use client';

import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { supabasePKCE } from '@/utils/supabase/client';

type UserMini = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url?: string | null;
};

function getInitials(nameOrEmail: string | null | undefined) {
  if (!nameOrEmail) return 'M';
  const clean = nameOrEmail.split('@')[0] ?? nameOrEmail;
  const parts = clean.split(' ').filter(Boolean);
  if (!parts.length) return 'M';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[1]![0]).toUpperCase();
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-page text-white antialiased">
        <TopNav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}

function TopNav() {
  const [user, setUser] = useState<UserMini | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabasePKCE.auth.getUser();
        const u = data.user;
        if (!u || cancelled) {
          setUser(null);
          return;
        }
        setUser({
          id: u.id,
          name:
            (u.user_metadata as any)?.name ??
            u.email ??
            'Jogador',
          email: u.email ?? null,
          avatar_url: (u.user_metadata as any)?.avatar_url ?? null,
        });
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    try {
      await supabasePKCE.auth.signOut();
    } catch {
      // ignora erros de logout
    } finally {
      setUser(null);
      setMenuOpen(false);
      router.push('/auth');
    }
  }

  const navLink = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className={clsx(
        'text-xs md:text-sm transition-colors',
        pathname === href
          ? 'text-white'
          : 'text-white/75 hover:text-white',
      )}
    >
      {label}
    </Link>
  );

  const navItems = [
    { href: '/rankings', label: 'Rankings' },
    { href: '/premios', label: 'Prémios' },
    { href: '/regras', label: 'Regras' },
  ];

  return (
    <header className="nav-glass sticky top-0 z-50">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        {/* Logo desktop (esquerda) */}
        <div className="hidden md:flex items-center">
          <Link href="/jogos" className="flex items-center gap-2">
            <Image
              src="/logos/predictor-03.svg"
              alt="+FCP Predictor"
              width={140}
              height={40}
              priority
              className="h-7 w-auto md:h-8"
            />
          </Link>
        </div>

        {/* Logo centrado em mobile */}
        <div className="flex flex-1 justify-center md:hidden">
          <Link href="/jogos" className="flex items-center">
            <Image
              src="/logos/predictor-03.svg"
              alt="+FCP Predictor"
              width={170}
              height={48}
              priority
              className="h-8 w-auto"
            />
          </Link>
        </div>

        {/* Nav desktop */}
        <nav className="hidden md:flex flex-1 items-center justify-center gap-6">
          {navItems.map((item) => navLink(item.href, item.label))}
        </nav>

        {/* Área direita (user + hamburger) */}
        <div className="flex items-center gap-3">
          {/* Chip de user em desktop */}
          {user && (
            <div className="hidden md:flex items-center gap-2 rounded-full bg-white/7 px-3 py-1 text-xs shadow-sm border border-white/10">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">
                {getInitials(user.name ?? user.email)}
              </div>
              <span className="max-w-[120px] truncate">
                {user.name ?? user.email ?? 'Jogador'}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10 transition"
              >
                <span className="text-[13px]">↩︎</span>
                <span>Terminar sessão</span>
              </button>
            </div>
          )}

          {/* Menu mobile (só se houver user) */}
          {user && (
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 border border-white/15 md:hidden transition-transform active:scale-95"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {menuOpen ? (
                // X
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                // Hamburger
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Menu mobile overlay */}
      {user && (
        <div
          className={clsx(
            'md:hidden origin-top transform border-b border-white/10 bg-[#040826]/95 backdrop-blur-xl transition-all duration-200',
            menuOpen
              ? 'scale-y-100 opacity-100'
              : 'pointer-events-none scale-y-95 opacity-0 -translate-y-1',
          )}
        >
          <div className="mx-auto max-w-6xl px-4 pb-4 pt-3 space-y-4">
            {/* Bloco com info do user */}
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                {getInitials(user.name ?? user.email)}
              </div>
              <div className="min-w-0">
                <div className="text-xs text-white/60">Ligado como</div>
                <div className="truncate text-sm font-medium">
                  {user.name ?? user.email ?? 'Jogador'}
                </div>
              </div>
            </div>

            <nav className="space-y-3 text-base">
              {navItems.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(item.href);
                  }}
                  className={clsx(
                    'block w-full text-left transition-colors',
                    pathname === item.href
                      ? 'text-white'
                      : 'text-white/80 hover:text-white',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex items-center gap-2 text-sm text-red-200 hover:text-red-100"
            >
              <span className="text-lg">↩︎</span>
              <span>Terminar sessão</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-white/10">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs leading-relaxed text-white/70 text-center">
        <div className="opacity-80">
          © {new Date().getFullYear()} +FCPorto Predictor. Todos os direitos
          reservados.
        </div>
        <div className="mt-1">
          As marcas, nomes e logótipos do +FCPorto e da Betano são propriedade
          dos respetivos titulares e estão protegidos por direitos de autor
          e/ou marcas registadas. Não é permitida a utilização para fins
          comerciais sem autorização.
        </div>
        <div className="mt-1">
          A utilização deste site implica a aceitação dos{' '}
          <Link
            href="/regras"
            className="underline underline-offset-2 hover:text-white/90"
          >
            Termos e Condições
          </Link>{' '}
          deste projeto.
        </div>
      </div>
    </footer>
  );
}
