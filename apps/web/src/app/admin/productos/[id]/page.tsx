'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  api,
  type AccionModeracion,
  type ColaModeracion,
  type FichaProductoModeracion,
  type MotivoPausa,
} from '@/lib/api-client';
import { formatDate, formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { PageSkeleton } from '@/components/ui/skeleton';
import { ProductStatus } from '@/components/ui/product-status';
import { AccionConMotivo, haceCuanto, numero } from '@/components/admin/controles';

const HECHOS: Record<AccionModeracion, string> = {
  aprobar: 'Producto aprobado',
  rechazar: 'Producto rechazado',
  pausar: 'Producto pausado',
  reactivar: 'Producto reactivado',
};

const MOTIVOS: Partial<Record<MotivoPausa, string>> = {
  revision: 'enviado a revisión',
  rechazado: 'rechazado',
  moderacion: 'pausado por moderación',
  manual: 'pausado por la tienda',
  limite_plan: 'pausado por el límite del plan',
};

const ESTADOS = { borrador: 'guardado como borrador', publicado: 'publicado', pausado: 'pausado', archivado: 'archivado' };

export default function AdminProductPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [p, setProducto] = useState<FichaProductoModeracion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [foto, setFoto] = useState(0);

  const cargar = useCallback(() => {
    api<FichaProductoModeracion>(`/admin/products/${params.id}`)
      .then(setProducto)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  useEffect(cargar, [cargar]);

  /** Después de aprobar o rechazar, sigue con el próximo producto de la cola. */
  async function siguienteEnCola() {
    const cola = await api<ColaModeracion>('/admin/products?vista=revision').catch(() => null);
    const siguiente = cola?.items.find((i) => i.id !== params.id);
    router.push(siguiente ? `/admin/productos/${siguiente.id}` : '/admin/productos?vista=revision');
  }

  /** Sin nota atrapa el error acá; con nota lo muestra el formulario. */
  async function moderar(accion: AccionModeracion, nota?: string) {
    if (!p) return;
    const enRevision = p.motivo_pausa === 'revision' || p.motivo_pausa === 'rechazado';
    setOcupado(true);
    setError(null);
    try {
      await api(`/admin/products/${params.id}/moderacion`, { method: 'POST', body: { accion, nota } });
      toast({ titulo: HECHOS[accion], texto: `${p.nombre} · ${p.tienda.nombre}` });
      if (enRevision && (accion === 'aprobar' || accion === 'rechazar')) await siguienteEnCola();
      else cargar();
    } catch (e) {
      if (nota !== undefined) throw e;
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setOcupado(false);
    }
  }

  const volver = (
    <Link href="/admin/productos" className="muted">
      ← Productos y moderación
    </Link>
  );

  if (error && !p) {
    return (
      <div className="stack">
        {volver}
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!p) return <PageSkeleton />;

  const imagen = p.imagenes[Math.min(foto, p.imagenes.length - 1)];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          {volver}
          <h1>{p.nombre}</h1>
          <p className="muted">
            <Link href={`/admin/tiendas/${p.tienda.id}`}>{p.tienda.nombre}</Link> ·{' '}
            {p.categoria.ruta.split('/').filter(Boolean).join(' › ')}
          </p>
        </div>
        <ProductStatus estado={p.estado} motivo={p.motivo_pausa} />
      </div>

      {error && <Alert>{error}</Alert>}

      <section className="card stack moderacion-panel">
        {p.motivo_pausa === 'revision' && (
          <>
            <p>
              <strong>Esperando revisión</strong>
              {p.revision_desde && <span className="muted"> · enviado {haceCuanto(p.revision_desde)}</span>}
            </p>
            {p.nota_moderacion && (
              <p className="nota-moderacion">
                <strong>Lo habían rechazado por:</strong> {p.nota_moderacion}
              </p>
            )}
            <div className="actions">
              <button className="btn" disabled={ocupado} onClick={() => moderar('aprobar')}>
                <Icon name="check" size={18} /> Aprobar y publicar
              </button>
              <AccionConMotivo
                label="Rechazar"
                pregunta="¿Qué tiene que corregir el vendedor?"
                ayuda="El vendedor lo ve junto al producto. Cuando lo corrija, vuelve a esta cola."
                confirmar="Rechazar producto"
                peligro
                disabled={ocupado}
                onConfirmar={(nota) => moderar('rechazar', nota)}
              />
            </div>
          </>
        )}
        {p.motivo_pausa === 'rechazado' && (
          <>
            <p className="nota-moderacion">
              <strong>Rechazado:</strong> {p.nota_moderacion}
            </p>
            <p className="muted">Cuando el vendedor lo corrija y lo envíe de nuevo, vuelve a la cola de revisión.</p>
            <div className="actions">
              <button className="btn btn-secondary" disabled={ocupado} onClick={() => moderar('aprobar')}>
                Aprobar igual
              </button>
            </div>
          </>
        )}
        {p.motivo_pausa === 'moderacion' && (
          <>
            <p className="nota-moderacion">
              <strong>Pausado por moderación:</strong> {p.nota_moderacion}
            </p>
            <div className="actions">
              <button className="btn" disabled={ocupado} onClick={() => moderar('reactivar')}>
                Reactivar
              </button>
            </div>
          </>
        )}
        {p.estado === 'publicado' && (
          <>
            <p>
              <strong>Publicado</strong>
              {p.publicado_en && <span className="muted"> desde el {formatDate(p.publicado_en)}</span>}
              {p.aprobadoPor && <span className="muted"> · aprobado por {p.aprobadoPor}</span>}
            </p>
            <div className="actions">
              {p.tienda.estado === 'activa' && (
                <a
                  href={`/tiendas/${p.tienda.slug}/${p.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                >
                  <Icon name="external" size={16} /> Ver en el sitio
                </a>
              )}
              <AccionConMotivo
                label="Pausar por moderación"
                pregunta="¿Por qué se pausa este producto?"
                ayuda="El vendedor lo ve junto al producto. Solo moderación lo puede reactivar."
                confirmar="Pausar producto"
                peligro
                disabled={ocupado}
                onConfirmar={(nota) => moderar('pausar', nota)}
              />
            </div>
          </>
        )}
        {(p.estado === 'borrador' ||
          p.estado === 'archivado' ||
          p.motivo_pausa === 'manual' ||
          p.motivo_pausa === 'limite_plan') && (
          <p className="muted">
            No está visible:{' '}
            {p.estado === 'pausado' ? MOTIVOS[p.motivo_pausa!] : p.estado === 'borrador' ? 'es un borrador' : 'está archivado'}.
          </p>
        )}
      </section>

      <div className="revision-producto">
        <section className="card stack">
          <h2>Fotos</h2>
          {imagen ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagen.url} alt={p.nombre} className="revision-foto" />
              {p.imagenes.length > 1 && (
                <div className="revision-miniaturas">
                  {p.imagenes.map((img, i) => (
                    <button
                      key={img.id}
                      aria-label={`Ver foto ${i + 1}`}
                      aria-pressed={i === foto}
                      onClick={() => setFoto(i)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="nota-moderacion">
              <Icon name="image" size={16} /> El producto no tiene fotos.
            </p>
          )}
        </section>

        <section className="card stack">
          <h2>Descripción</h2>
          {p.descripcion ? <p className="texto-largo">{p.descripcion}</p> : <p className="muted">Sin descripción.</p>}
          {p.ficha.length > 0 && (
            <dl className="datos ficha">
              {p.ficha.map((f) => (
                <div key={f.atributo} className="datos-fila">
                  <dt>{f.atributo}</dt>
                  <dd>{f.valor}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <section className="card stack">
        <h2>Precio y stock</h2>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Variante</th>
                <th>Precio</th>
                <th>Oferta</th>
                <th>Stock</th>
                <th>SKU</th>
              </tr>
            </thead>
            <tbody>
              {p.variantes.map((v) => (
                <tr key={v.id}>
                  <td>{v.opciones ?? 'Única'}</td>
                  <td>{formatPrice(Number(v.precio))}</td>
                  <td>{v.precio_oferta !== null ? formatPrice(Number(v.precio_oferta)) : '—'}</td>
                  <td>{numero(v.stock)}</td>
                  <td>{v.sku ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="admin-bloques">
        <section className="card stack">
          <h2>La tienda</h2>
          <dl className="datos">
            <dt>Tienda</dt>
            <dd>
              <Link href={`/admin/tiendas/${p.tienda.id}`}>{p.tienda.nombre}</Link>
            </dd>
            <dt>Productos aprobados</dt>
            <dd>{numero(p.tienda.aprobados)}</dd>
            <dt>Revisión</dt>
            <dd>
              {p.tienda.revision_productos === 'siempre'
                ? 'Revisa todo'
                : p.tienda.revision_productos === 'nunca'
                  ? 'Sin revisión'
                  : 'Automática'}
            </dd>
            <dt>Producto creado</dt>
            <dd>{formatDate(p.creado_en)}</dd>
          </dl>
        </section>

        <section className="card stack">
          <h2>Historial</h2>
          {p.historial.length === 0 ? (
            <p className="muted">Sin movimientos registrados.</p>
          ) : (
            <ListaScroll as="ol" className="historial" etiqueta="Historial del producto" alto="26rem">
              {p.historial.map((h, i) => (
                <li key={i}>
                  <time className="muted" dateTime={h.fecha}>
                    {new Date(h.fecha).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                  </time>
                  <p>
                    {h.estado === 'pausado' && h.motivo ? MOTIVOS[h.motivo] : ESTADOS[h.estado]}
                    {h.actor && <span className="muted"> · por {h.actor}</span>}
                  </p>
                  {h.nota && (h.motivo === 'rechazado' || h.motivo === 'moderacion') && (
                    <p className="muted">«{h.nota}»</p>
                  )}
                </li>
              ))}
            </ListaScroll>
          )}
        </section>
      </div>
    </div>
  );
}
