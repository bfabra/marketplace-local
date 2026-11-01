'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { ApiError, api, type ImagenProducto, type ProductoEdicion } from '@/lib/api-client';
import { Alert } from '@/components/ui/alert';

const MAX_FOTOS = 8;

interface ProductImagesProps {
  base: string;
  imagenes: ImagenProducto[];
  puedeEditar: boolean;
  onChange: (producto: ProductoEdicion) => void;
}

/** Fotos del producto: la primera es la principal y es la que se ve en los listados. */
export function ProductImages({ base, imagenes, puedeEditar, onChange }: ProductImagesProps) {
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar(accion: () => Promise<ProductoEdicion>) {
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
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (archivos.length === 0) return;
    const form = new FormData();
    archivos.forEach((archivo) => form.append('fotos', archivo));
    ejecutar(() => api<ProductoEdicion>(`${base}/imagenes`, { method: 'POST', body: form }));
  }

  return (
    <section className="card stack">
      <div className="page-head">
        <h2>Fotos</h2>
        <span className="muted">
          {imagenes.length} de {MAX_FOTOS}
        </span>
      </div>
      {error && <Alert>{error}</Alert>}

      {imagenes.length === 0 ? (
        <p className="muted">Todavía no tiene fotos. Los productos con fotos se venden mucho más.</p>
      ) : (
        <ul className="fotos">
          {imagenes.map((imagen, i) => (
            <li key={imagen.id} className="foto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagen.url} alt={`Foto ${i + 1}`} />
              {i === 0 && <span className="badge badge-activa foto-principal">Principal</span>}
              {puedeEditar && (
                <div className="foto-acciones">
                  {i > 0 && (
                    <button
                      type="button"
                      className="btn-link"
                      disabled={ocupado}
                      onClick={() =>
                        ejecutar(() =>
                          api<ProductoEdicion>(`${base}/imagenes/${imagen.id}/principal`, { method: 'POST' })
                        )
                      }
                    >
                      Hacer principal
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-link btn-link-peligro"
                    disabled={ocupado}
                    onClick={() =>
                      ejecutar(() => api<ProductoEdicion>(`${base}/imagenes/${imagen.id}`, { method: 'DELETE' }))
                    }
                  >
                    Quitar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {puedeEditar && imagenes.length < MAX_FOTOS && (
        <div className="actions">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={subir}
          />
          <button type="button" className="btn btn-secondary" disabled={ocupado} onClick={() => input.current?.click()}>
            {ocupado ? 'Subiendo…' : 'Agregar fotos'}
          </button>
          <small className="field-hint">JPG, PNG o WEBP de hasta 5 MB cada una.</small>
        </div>
      )}
    </section>
  );
}
