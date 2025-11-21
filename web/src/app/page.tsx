// web/src/app/page.tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Home() {
  // cookies() agora é async
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  // Se existir sessão -> vai para /jogos
  if (token) {
    redirect('/jogos');
  }

  // Senão -> vai para /auth
  redirect('/auth');
}
