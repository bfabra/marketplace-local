'use client';

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, api, type FichaPedidoAdmin, type ParteAdmin, type ReembolsoAdmin } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';
import { ESTADO_PAGO, ESTADO_PEDIDO, MODALIDAD } from '@/lib/pedidos';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { PageSkeleton } from '@/components/ui/skeleton';
import { AccionConMotivo, BotonConfirmar } from '@/components/admin/controles';
import { ESTADO_REEMBOLSO, EstadoPedido, fechaHora } from '@/components/admin/operaciones';

const ESTADO_ENVIO: Record<NonNullable<FichaPedidoAdmin['envio']>['estado'], string> = {
  pendiente: 'Sin repartidor asignado',
  en_recoleccion: 'Retirando en las tiendas',
  en_camino: 'En camino',
  entregado: 'Entregado',
  fallido: 'No se entrega (cancelado o fallido)',
};

const ESTADO_RECOLECCION: Record<string, string> = {
  pendiente: 'Pendiente',
  asignada: 'Asignada',
  recolectada: 'Retirada',
  fallida: 'Fallida',
};

const pesos = (n: number) => formatPrice(Number(n));

export default function AdminOrderPage({ params }: { params: { id: string } }) {
  const toast = useToast();
  const [p, setPedido] = useState<FichaPedidoAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api<FichaPedidoAdmin>(`/admin/pedidos/${params.id}`)
      .then(setPedido)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  useEffect(cargar, [cargar]);

  async function cancelar(parte: ParteAdmin, motivo: string) {
    const r = await api<FichaPedidoAdmin>(`/admin/pedidos/${params.id}/partes/${parte.id}/cancelacion`, {
      method: 'POST',
      body: { motivo },
    });
    setPedido(r);
    toast({
      titulo: `Se canceló la parte de ${parte.tienda.nombre}`,
      texto: 'Volvió el stock y el reembolso quedó pendiente para finanzas.',
    });
  }

  async function procesar(r: ReembolsoAdmin, aprobar: boolean, nota?: string) {
    try {
      const actualizado = await api<FichaPedidoAdmin>(`/admin/pedidos/${params.id}/reembolsos/${r.id}`, {
        method: 'PATCH',
        body: { aprobar, nota },
      });
      setPedido(actualizado);
      toast(
        aprobar
          ? { titulo: 'Reembolso devuelto', texto: `${pesos(r.monto)} vuelven al comprador por Mercado Pago.` }
          : { titulo: 'Reembolso rechazado', texto: 'Queda registrado con tu nota.' }
      );
    } catch (e) {
      if (nota !== undefined) throw e;
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }

  const volver = (
    <Link href="/admin/pedidos" className="muted">
      ← Pedidos
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

  const dir = p.direccion_envio;
  const devuelto = p.reembolsos.filter((r) => r.estado === 'procesado').reduce((s, r) => s + Number(r.monto), 0);
  const pendientes = p.reembolsos.filter((r) => r.estado === 'pendiente');

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          {volver}
          <h1>Pedido #{p.numero}</h1>
          <p className="muted">{fechaHora(p.creado_en)}</p>
        </div>
        <div className="pedido-total">
          <strong>{pesos(p.total)}</strong>
          <span className="muted">{ESTADO_PAGO[p.estado_pago]}</span>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {pendientes.length > 0 && (
        <div className="aviso-banda aviso-advertencia">
          <Icon name="card" size={18} />
          <span>
            {pendientes.length === 1 ? 'Hay un reembolso pendiente' : `Hay ${pendientes.length} reembolsos pendientes`} por{' '}
            {pesos(pendientes.reduce((s, r) => s + Number(r.monto), 0))}.
            {p.permisos.reembolsar ? ' Revisalos más abajo.' : ' Lo resuelve finanzas.'}
          </span>
        </div>
      )}

      <div className="admin-bloques">
        <section className="card stack">
          <h2>Comprador</h2>
          <dl className="datos">
            <dt>Nombre</dt>
            <dd>
              {p.permisos.verUsuarios ? (
                <Link href={`/admin/usuarios/${p.comprador.id}`}>{p.comprador.nombre ?? 'Sin nombre'}</Link>
              ) : (
                p.comprador.nombre ?? 'Sin nombre'
              )}
              {p.comprador.bloqueado && <span className="badge badge-suspendida badge-en-linea">Bloqueada</span>}
            </dd>
            <dt>Correo</dt>
            <dd>{p.comprador.email ? <a href={`mailto:${p.comprador.email}`}>{p.comprador.email}</a> : '—'}</dd>
            <dt>Teléfono</dt>
            <dd>{p.comprador.telefono ?? '—'}</dd>
            <dt>Entrega</dt>
            <dd>
              {dir
                ? `${dir.calle} ${dir.numero}${dir.piso_depto ? `, ${dir.piso_depto}` : ''}, ${dir.localidad}, ${dir.provincia}`
                : 'Retira en el local'}
              {dir?.referencias && <span className="muted"> · {dir.referencias}</span>}
            </dd>
          </dl>
        </section>

        <section className="card stack">
          <h2>Importes</h2>
          <dl className="datos">
            <dt>Productos</dt>
            <dd>{pesos(p.subtotal)}</dd>
            <dt>Envío</dt>
            <dd>{Number(p.costo_envio) > 0 ? pesos(p.costo_envio) : 'Sin costo'}</dd>
            <dt>Total</dt>
            <dd>
              <strong>{pesos(p.total)}</strong>
            </dd>
            {devuelto > 0 && (
              <>
                <dt>Devuelto</dt>
                <dd>{pesos(devuelto)}</dd>
              </>
            )}
          </dl>
        </section>
      </div>

      {p.partes.map((parte) => (
        <Parte
          key={parte.id}
          parte={parte}
          permisos={p.permisos}
          onCancelar={(motivo) => cancelar(parte, motivo)}
          onReembolsado={(actualizado, monto) => {
            setPedido(actualizado);
            toast({ titulo: 'Dinero devuelto', texto: `${pesos(monto)} vuelven al comprador por Mercado Pago.` });
          }}
          pedidoId={p.id}
        />
      ))}

      {p.envio && (
        <section className="card stack">
          <h2>
            <Icon name="truck" size={18} /> Envío
          </h2>
          <dl className="datos">
            <dt>Estado</dt>
            <dd>{ESTADO_ENVIO[p.envio.estado]}</dd>
            <dt>Repartidor</dt>
            <dd>{p.envio.repartidor ? `${p.envio.repartidor.nombre} · ${p.envio.repartidor.telefono}` : 'Sin asignar'}</dd>
            {p.envio.entregado_en && (
              <>
                <dt>Entregado</dt>
                <dd>{fechaHora(p.envio.entregado_en)}</dd>
              </>
            )}
          </dl>
          {p.envio.recolecciones && (
            <ul className="lista-simple">
              {p.envio.recolecciones.map((r) => (
                <li key={r.tienda} className="fila-con-estado">
                  <span>
                    Retiro en <strong>{r.tienda}</strong>
                    {r.recolectado_en && <span className="muted"> · {fechaHora(r.recolectado_en)}</span>}
                  </span>
                  <span className="muted">{ESTADO_RECOLECCION[r.estado] ?? r.estado}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card stack">
        <h2>
          <Icon name="card" size={18} /> Reembolsos
        </h2>
        {p.reembolsos.length === 0 ? (
          <p className="muted">No hubo devoluciones.</p>
        ) : (
          <ListaScroll as="ul" className="admin-lista" etiqueta="Reembolsos" alto="30rem">
            {p.reembolsos.map((r) => (
              <li key={r.id} className="reembolso">
                <div className="fila-con-estado">
                  <span>
                    <strong>{pesos(r.monto)}</strong>{' '}
                    <span className="muted">
                      · {r.es_envio ? 'costo de envío' : r.tienda} · {fechaHora(r.creado_en)}
                      {r.creadoPor ? ` · cargado por ${r.creadoPor}` : ''}
                    </span>
                  </span>
                  <span className={`badge ${ESTADO_REEMBOLSO[r.estado].badge}`}>{ESTADO_REEMBOLSO[r.estado].label}</span>
                </div>
                <p className="muted">Motivo: {r.motivo}</p>
                {r.estado !== 'pendiente' && (
                  <p className="muted">
                    {r.estado === 'procesado' ? 'Devuelto' : 'Rechazado'}
                    {r.procesado_en ? ` el ${fechaHora(r.procesado_en)}` : ''}
                    {r.procesadoPor ? ` por ${r.procesadoPor}` : ''}
                    {r.mp_refund_id ? ` · ${r.mp_refund_id}` : ''}
                    {r.nota ? ` · ${r.nota}` : ''}
                  </p>
                )}
                {r.estado === 'pendiente' && p.permisos.reembolsar && (
                  <div className="actions">
                    <BotonConfirmar
                      label="Devolver"
                      className="btn"
                      pregunta={`¿Devolver ${pesos(r.monto)} al comprador?`}
                      confirmar="Sí, devolver"
                      onConfirmar={() => procesar(r, true)}
                    />
                    <AccionConMotivo
                      label="Rechazar"
                      pregunta="¿Por qué se rechaza este reembolso?"
                      ayuda="Queda registrado. El dinero no se devuelve."
                      confirmar="Rechazar reembolso"
                      peligro
                      onConfirmar={(nota) => procesar(r, false, nota)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ListaScroll>
        )}
      </section>

      {p.pagos && (
        <section className="card stack">
          <h2>Pagos</h2>
          {p.pagos.length === 0 ? (
            <p className="muted">Todavía no se registró ningún pago.</p>
          ) : (
            <ListaScroll as="ul" className="lista-simple" etiqueta="Pagos del pedido" alto="22rem">
              {p.pagos.map((pg) => (
                <li key={pg.id} className="fila-con-estado">
                  <span>
                    <strong>{pesos(pg.monto)}</strong>{' '}
                    <span className="muted">
                      · {fechaHora(pg.creado_en)} · {pg.mp_payment_id ?? 'sin referencia'} · comisión{' '}
                      {pesos(pg.comision_marketplace)}
                    </span>
                  </span>
                  <span className="muted">{pg.estado}</span>
                </li>
              ))}
            </ListaScroll>
          )}
        </section>
      )}
    </div>
  );
}

function Parte({
  parte,
  permisos,
  pedidoId,
  onCancelar,
  onReembolsado,
}: {
  parte: ParteAdmin;
  permisos: FichaPedidoAdmin['permisos'];
  pedidoId: string;
  onCancelar: (motivo: string) => Promise<void>;
  onReembolsado: (pedido: FichaPedidoAdmin, monto: number) => void;
}) {
  const [reembolsando, setReembolsando] = useState(false);
  const puedeReembolsar = permisos.reembolsar && Number(parte.reembolsable) > 0;

  return (
    <section className="card stack">
      <div className="admin-fila-cabecera">
        <div>
          <h2>{parte.tienda.nombre}</h2>
          <p className="muted">
            {MODALIDAD[parte.modalidad]}
            {parte.tienda.telefono ? ` · ${parte.tienda.telefono}` : ''}
          </p>
        </div>
        <EstadoPedido estado={parte.estado} />
      </div>

      <ListaScroll as="ul" className="lista-simple" etiqueta={`Productos de ${parte.tienda.nombre}`} alto="22rem">
        {parte.items.map((i, n) => (
          <li key={n} className="fila-con-estado">
            <span>
              {i.cantidad} × {i.nombre}
              {i.variante && <span className="muted"> · {i.variante}</span>}
            </span>
            <span>{pesos(i.subtotal)}</span>
          </li>
        ))}
      </ListaScroll>
      <p className="muted parte-totales">
        Total {pesos(parte.total)} · comisión de la plataforma {pesos(parte.comision)}
      </p>

      {parte.motivo_cancelacion && (
        <p className="nota-moderacion">
          <strong>Motivo de la cancelación:</strong> {parte.motivo_cancelacion}
        </p>
      )}
      {parte.reclamos && (
        <div className="aviso-banda aviso-advertencia">
          <Icon name="alert" size={18} />
          <span>
            {parte.reclamos.map((r) => `Reclamo ${r.estado.replace('_', ' ')}: ${r.motivo}`).join(' · ')}
          </span>
        </div>
      )}

      {parte.historial && (
        <details className="parte-historial">
          <summary>Historial ({parte.historial.length})</summary>
          <ListaScroll as="ol" className="historial" etiqueta={`Historial de ${parte.tienda.nombre}`} alto="22rem">
            {parte.historial.map((h, n) => (
              <li key={n}>
                <time className="muted" dateTime={h.fecha}>
                  {fechaHora(h.fecha)}
                </time>
                <p>
                  {ESTADO_PEDIDO[h.estado]}
                  <span className="muted"> · {h.actor ? `por ${h.actor}` : 'automático'}</span>
                </p>
                {h.nota && <p className="muted">{h.nota}</p>}
              </li>
            ))}
          </ListaScroll>
        </details>
      )}

      {(parte.cancelable && permisos.cancelar) || puedeReembolsar ? (
        <div className="actions">
          {parte.cancelable && permisos.cancelar && (
            <AccionConMotivo
              label="Cancelar esta parte"
              pregunta={`¿Por qué se cancela la parte de ${parte.tienda.nombre}?`}
              ayuda="Lo ven el comprador y la tienda. Vuelve el stock y, si estaba pagada, se genera el reembolso para finanzas."
              confirmar="Cancelar parte"
              peligro
              onConfirmar={onCancelar}
            />
          )}
          {puedeReembolsar && !reembolsando && (
            <button className="btn btn-secondary" onClick={() => setReembolsando(true)}>
              Devolver dinero
            </button>
          )}
        </div>
      ) : null}

      {reembolsando && (
        <FormReembolso
          pedidoId={pedidoId}
          parte={parte}
          onListo={(pedido, monto) => {
            setReembolsando(false);
            onReembolsado(pedido, monto);
          }}
          onCancelar={() => setReembolsando(false)}
        />
      )}
    </section>
  );
}

function FormReembolso({
  pedidoId,
  parte,
  onListo,
  onCancelar,
}: {
  pedidoId: string;
  parte: ParteAdmin;
  onListo: (pedido: FichaPedidoAdmin, monto: number) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const maximo = Number(parte.reembolsable);
  const [monto, setMonto] = useState(String(maximo));
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const valor = Number(monto.replace(',', '.'));
    if (!(valor > 0) || valor > maximo) {
      setError(`Ingresá un monto entre $1 y ${pesos(maximo)}.`);
      return;
    }
    if (motivo.trim().length < 5) {
      setError('Contale al comprador el motivo (al menos 5 caracteres).');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const pedido = await api<FichaPedidoAdmin>(`/admin/pedidos/${pedidoId}/reembolsos`, {
        method: 'POST',
        body: { parteId: parte.id, monto: valor, motivo: motivo.trim() },
      });
      onListo(pedido, valor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="motivo-form" onSubmit={enviar} noValidate>
      <label className="field" htmlFor={`${id}-monto`}>
        <span>Monto a devolver</span>
        <input
          id={`${id}-monto`}
          type="number"
          inputMode="decimal"
          min={1}
          max={maximo}
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <small className="field-hint">Queda por devolver de esta parte: {pesos(maximo)}.</small>
      </label>
      <label className="field" htmlFor={`${id}-motivo`}>
        <span>Motivo</span>
        <textarea
          id={`${id}-motivo`}
          rows={2}
          maxLength={500}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por ejemplo: el producto llegó dañado"
        />
        <small className="field-hint">Lo ve el comprador. Se devuelve en el acto por Mercado Pago.</small>
      </label>
      {error && <small className="field-error">{error}</small>}
      <div className="actions">
        <button className="btn" disabled={enviando}>
          {enviando ? 'Devolviendo…' : 'Devolver'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={enviando} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
