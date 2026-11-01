'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, type InvitacionPublica } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Alert } from '@/components/ui/alert';

const NO_VIGENTE: Record<string, string> = {
  aceptada: 'Esta invitación ya fue aceptada.',
  vencida: 'Esta invitación venció. Pedile al dueño de la tienda que te envíe una nueva.',
  anulada: 'El dueño de la tienda anuló esta invitación.',
};

export default function InvitationPage({ params }: { params: { token: string } }) {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [inv, setInv] = useState<InvitacionPublica | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aceptando, setAceptando] = useState(false);

  useEffect(() => {
    api<InvitacionPublica>(`/invitations/${params.token}`)
      .then(setInv)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.token]);

  async function aceptar() {
    setAceptando(true);
    setError(null);
    try {
      const { tiendaId } = await api<{ tiendaId: string }>(`/invitations/${params.token}/aceptar`, { method: 'POST' });
      await refresh();
      router.push(`/vendor/tiendas/${tiendaId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
      setAceptando(false);
    }
  }

  if (error && !inv) return <Alert>{error}</Alert>;
  if (!inv || loading) return <p>Cargando…</p>;

  const volver = encodeURIComponent(`/invitacion/${params.token}`);
  const otroCorreo = user && user.email?.toLowerCase() !== inv.email;

  return (
    <section className="card form stack">
      <h1>Te invitaron a {inv.tienda}</h1>
      <p>
        Vas a sumarte al equipo con el rol <strong>{inv.rol}</strong>, que te permite:
      </p>
      <ul className="lista-permisos">
        {inv.permisos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {error && <Alert>{error}</Alert>}

      {inv.estado !== 'pendiente' ? (
        <Alert kind="info">{NO_VIGENTE[inv.estado]}</Alert>
      ) : !user ? (
        <>
          <p className="muted">La invitación es para {inv.email}. Ingresá o creá tu cuenta con ese correo.</p>
          <div className="actions">
            <Link href={`/login?next=${volver}`} className="btn">
              Ingresar
            </Link>
            <Link href={`/registro?next=${volver}&email=${encodeURIComponent(inv.email)}`} className="btn btn-secondary">
              Crear cuenta
            </Link>
          </div>
        </>
      ) : otroCorreo ? (
        <Alert kind="info">
          La invitación es para {inv.email}, pero ingresaste como {user.email}. Salí e ingresá con la cuenta de ese
          correo.
        </Alert>
      ) : (
        <div className="actions">
          <button className="btn" onClick={aceptar} disabled={aceptando}>
            {aceptando ? 'Sumándote…' : 'Aceptar y sumarme'}
          </button>
        </div>
      )}
    </section>
  );
}
