'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { ApiError, api, type Tienda } from '@/lib/api-client';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';

type Tipo = 'portada' | 'logo';

const TEXTOS: Record<Tipo, { titulo: string; ayuda: string; vacia: string }> = {
  portada: {
    titulo: 'Foto de portada',
    ayuda: 'Se ve en las tarjetas del listado y arriba de tu tienda. Usá una foto horizontal del local o de tus productos.',
    vacia: 'Sin foto de portada: mostramos una foto de tus productos.',
  },
  logo: {
    titulo: 'Logo',
    ayuda: 'Se ve junto al nombre de tu tienda. Mejor si es cuadrado.',
    vacia: 'Sin logo: mostramos las iniciales de tu tienda.',
  },
};

function Imagen({ tienda, tipo, onChange }: { tienda: Tienda; tipo: Tipo; onChange: (t: Tienda) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = tienda[tipo];
  const textos = TEXTOS[tipo];
  const base = `/stores/${tienda.id}/imagen/${tipo}`;

  async function ejecutar(accion: () => Promise<Tienda>) {
    setOcupado(true);
    setError(null);
    try {
      onChange(await accion());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setOcupado(false);
    }
  }

  function subir(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    const form = new FormData();
    form.append('foto', archivo);
    ejecutar(() => api<Tienda>(base, { method: 'POST', body: form }));
  }

  return (
    <div className={`imagen-tienda imagen-tienda-${tipo}`}>
      <div className="imagen-tienda-vista">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${textos.titulo} de ${tienda.nombre}`} />
        ) : (
          <Icon name={tipo === 'portada' ? 'image' : 'store'} size={28} />
        )}
      </div>
      <div className="stack-sm">
        <strong>{textos.titulo}</strong>
        <small className="field-hint">{url ? textos.ayuda : textos.vacia}</small>
        {error && <Alert>{error}</Alert>}
        <div className="actions">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={subir} />
          <button type="button" className="btn btn-secondary" disabled={ocupado} onClick={() => input.current?.click()}>
            {ocupado ? 'Subiendo…' : url ? 'Cambiar' : 'Subir foto'}
          </button>
          {url && (
            <button
              type="button"
              className="btn-link btn-link-peligro"
              disabled={ocupado}
              onClick={() => ejecutar(() => api<Tienda>(base, { method: 'DELETE' }))}
            >
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Portada y logo de la tienda: JPG, PNG o WEBP de hasta 5 MB. */
export function ImagenesTienda({ tienda, onChange }: { tienda: Tienda; onChange: (t: Tienda) => void }) {
  return (
    <section className="card stack">
      <div className="page-head">
        <h2>Imagen de la tienda</h2>
        <span className="muted">JPG, PNG o WEBP de hasta 5 MB</span>
      </div>
      <Imagen tienda={tienda} tipo="portada" onChange={onChange} />
      <Imagen tienda={tienda} tipo="logo" onChange={onChange} />
    </section>
  );
}
