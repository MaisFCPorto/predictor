'use client';
import RequireAuth from '@/components/RequireAuth';

export default function AdminIndex() {
  // no futuro: validar role admin e mostrar 403 se não for
  return (
    <RequireAuth>
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold">Backoffice</h1>
        <ul className="list-inside list-disc opacity-80">
          <li><a className="underline" href="/admin/users">Users</a></li>
          <li><a className="underline" href="/admin/teams">Equipas</a></li>
          <li><a className="underline" href="/admin/matchdays">Competições / Jornadas</a></li>
          <li><a className="underline" href="/admin/fixtures">Jogos</a></li>
        </ul>
      </main>
    </RequireAuth>
  );
}
