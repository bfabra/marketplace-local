'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api, type EstadoSeguimiento } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Icon } from '@/components/ui/icon';

/** Sin sesión lleva a ingresar y vuelve a la tienda. El dueño no ve el botón. */
export function FollowButton({
  tienda,
  onSeguidores,
}: {
  tienda: { id: string; slug: string; nombre: string };
  onSeguidores: (n: number) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { user, loading } = useAuth();
  const [siguiendo, setSiguiendo] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const esDuenio = !!user?.tiendas.some((t) => t.id === tienda.id && t.rol === 'propietario');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setSiguiendo(false);
      return;
    }
    let vigente = true;
    api<string[]>('/seguidos/ids')
      .then((ids) => vigente && setSiguiendo(ids.includes(tienda.id)))
      .catch(() => vigente && setSiguiendo(false));
    return () => {
      vigente = false;
    };
  }, [user, loading, tienda.id]);

  if (esDuenio) return null;

  async function alternar() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/tiendas/${tienda.slug}`)}`);
      return;
    }
    setOcupado(true);
    try {
      const r = await api<EstadoSeguimiento>(`/seguidos/${tienda.id}`, { method: siguiendo ? 'DELETE' : 'PUT' });
      const ahora = r.ids.includes(tienda.id);
      setSiguiendo(ahora);
      onSeguidores(r.seguidores);
      toast({
        titulo: ahora ? `Seguís a ${tienda.nombre}` : `Dejaste de seguir a ${tienda.nombre}`,
        texto: ahora ? 'Vas a ver sus novedades en tus sugerencias.' : undefined,
      });
    } catch (e) {
      toast({ titulo: e instanceof ApiError ? e.message : 'No pudimos actualizar', tipo: 'error' });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn seguir-btn ${siguiendo ? 'btn-secondary seguir-activo' : 'btn-accent'}`}
      aria-pressed={!!siguiendo}
      disabled={ocupado || siguiendo === null}
      onClick={alternar}
    >
      <Icon name={siguiendo ? 'check' : 'plus'} size={18} />
      <span className="seguir-texto">{siguiendo ? 'Siguiendo' : 'Seguir tienda'}</span>
      {siguiendo && <span className="seguir-dejar">Dejar de seguir</span>}
    </button>
  );
}
