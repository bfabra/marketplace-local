'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type FichaUsuarioAdmin, type ResultadoBloqueo } from '@/lib/api-client';
import { formatDate, formatPrice } from '@/lib/utils';
import { ESTADO_PAGO } from '@/lib/pedidos';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StoreStatus } from '@/components/ui/store-status';
import { AccionConMotivo, haceCuanto, numero } from '@/components/admin/controles';
import { ROL_LABEL, fechaHora } from '@/components/admin/operaciones';

const tiendasTexto = (n: number) => (n === 1 ? '1 tienda' : `${n} tiendas`);
const seSuspendieron = (n: number) => (n === 1 ? 'se suspendió 1 tienda' : `se suspendieron ${n} tiendas`);

export default function AdminUserPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const toast = useToast();
  const [u, setUsuario] = useState<FichaUsuarioAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api<FichaUsuarioAdmin>(`/admin/usuarios/${params.id}`)
      .then(setUsuario)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  useEffect(cargar, [cargar]);

  const misRoles = user?.rolesPlataforma ?? [];
  const soySuperadmin = misRoles.includes('superadmin');
  const veoTiendas = soySuperadmin || misRoles.includes('moderacion');

  async function bloquear(motivo: string) {
    const r = await api<ResultadoBloqueo>(`/admin/usuarios/${params.id}/bloqueo`, {
      method: 'POST',
      body: { motivo },
    });
    setUsuario(r.usuario);
    const n = r.resultado.tiendasSuspendidas ?? 0;
    toast({
      titulo: 'Cuenta bloqueada',
      texto: n ? `Ya no puede ingresar y ${seSuspendieron(n)}.` : 'Ya no puede ingresar.',
    });
  }

  async function desbloquear(nota: string) {
    const r = await api<ResultadoBloqueo>(`/admin/usuarios/${params.id}/desbloqueo`, {
      method: 'POST',
      body: { nota },
    });
    setUsuario(r.usuario);
    const vuelven = r.resultado.tiendasRestauradas ?? 0;
    const quedan = (r.resultado.tiendasSuspendidas ?? 0) - vuelven;
    toast({
      titulo: 'Cuenta desbloqueada',
      texto:
        (vuelven === 1
          ? 'Ya puede ingresar y su tienda volvió a su estado anterior.'
          : vuelven
            ? `Ya puede ingresar y ${tiendasTexto(vuelven)} volvieron a su estado anterior.`
            : 'Ya puede ingresar.') +
        (quedan === 1
          ? ' Una tienda no se tocó porque moderación la cambió mientras tanto.'
          : quedan > 1
            ? ` ${tiendasTexto(quedan)} no se tocaron porque moderación las cambió mientras tanto.`
            : ''),
    });
  }

  const volver = (
    <Link href="/admin/usuarios" className="muted">
      ← Usuarios
    </Link>
  );

  if (error && !u) {
    return (
      <div className="stack">
        {volver}
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!u) return <PageSkeleton />;

  const nombre = [u.nombre, u.apellido].filter(Boolean).join(' ') || u.email || 'Sin nombre';
  const esYo = user?.id === u.id;
  const esSuperadmin = u.roles.includes('superadmin');
  const esEquipo = u.roles.length > 0;
  const noPuede = (verbo: 'bloquear' | 'desbloquear') =>
    esYo
      ? `No podés ${verbo} tu propia cuenta.`
      : esSuperadmin
        ? `La cuenta del superadmin no se puede ${verbo}.`
        : esEquipo && !soySuperadmin
          ? `Es parte del equipo de la plataforma: solo el superadmin puede ${verbo}la.`
          : null;
  const tiendasActivas = u.tiendas.filter((t) => t.estado === 'activa' || t.estado === 'pendiente').length;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          {volver}
          <h1>{nombre}</h1>
          <p className="muted">
            Cuenta desde el {formatDate(u.creado_en)} ·{' '}
            {u.ultimo_ingreso ? `último ingreso ${haceCuanto(u.ultimo_ingreso)}` : 'sin ingresos registrados'}
          </p>
        </div>
        <div className="actions">
          {u.bloqueo ? (
            <span className="badge badge-suspendida">Bloqueada</span>
          ) : (
            <span className="badge badge-activa">Activa</span>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <section className="card stack">
        <h2>Acceso a la cuenta</h2>
        {u.bloqueo ? (
          <>
            <div className="aviso-banda aviso-advertencia">
              <Icon name="lock" size={18} />
              <div>
                <strong>
                  Bloqueada desde el {fechaHora(u.bloqueo.desde)}
                  {u.bloqueo.por ? ` por ${u.bloqueo.por}` : ''}.
                </strong>{' '}
                Motivo: {u.bloqueo.motivo}
                {u.bloqueo.tiendas > 0 && <> · {u.bloqueo.tiendas === 1 ? 'Se suspendió 1 tienda' : `Se suspendieron ${u.bloqueo.tiendas} tiendas`}.</>}
              </div>
            </div>
            {noPuede('desbloquear') ? (
              <p className="muted">{noPuede('desbloquear')}</p>
            ) : (
              <div className="actions">
                <AccionConMotivo
                  label="Desbloquear"
                  pregunta="¿Por qué se desbloquea?"
                  ayuda="Queda en el historial. Las tiendas suspendidas por el bloqueo vuelven al estado que tenían, salvo las que moderación haya cambiado."
                  confirmar="Desbloquear cuenta"
                  onConfirmar={desbloquear}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <p className="muted">
              Una cuenta bloqueada no puede ingresar y se cierran sus sesiones abiertas.
              {tiendasActivas > 0 &&
                (tiendasActivas === 1
                  ? ' Su tienda queda suspendida hasta que se desbloquee.'
                  : ` Sus ${tiendasTexto(tiendasActivas)} activas o pendientes quedan suspendidas hasta que se desbloquee.`)}
            </p>
            {noPuede('bloquear') ? (
              <p className="muted">
                <Icon name="info" size={16} /> {noPuede('bloquear')}
              </p>
            ) : (
              <div className="actions">
                <AccionConMotivo
                  label="Bloquear cuenta"
                  pregunta="¿Por qué se bloquea?"
                  ayuda="Queda en el historial y lo ve el equipo. A la persona solo le avisamos que su cuenta está bloqueada y que escriba a soporte."
                  confirmar="Bloquear cuenta"
                  peligro
                  onConfirmar={bloquear}
                />
              </div>
            )}
          </>
        )}
      </section>

      <div className="admin-bloques">
        <section className="card stack">
          <h2>Datos</h2>
          <dl className="datos">
            <dt>Correo</dt>
            <dd>{u.email ? <a href={`mailto:${u.email}`}>{u.email}</a> : '—'}</dd>
            <dt>Teléfono</dt>
            <dd>{u.telefono ?? '—'}</dd>
            <dt>Direcciones</dt>
            <dd>{numero(u.direcciones)}</dd>
            <dt>Reclamos abiertos</dt>
            <dd>{numero(u.reclamosAbiertos)}</dd>
            <dt>Roles</dt>
            <dd>
              {u.roles.length === 0 ? (
                'Sin roles de plataforma'
              ) : (
                <span className="admin-fila-indicadores">
                  {u.roles.map((r) => (
                    <span key={r} className="indicador indicador-info">
                      {ROL_LABEL[r]}
                    </span>
                  ))}
                </span>
              )}
            </dd>
          </dl>
        </section>

        <section className="card admin-bloque">
          <h2>
            <Icon name="bag" size={18} /> Compras
          </h2>
          <div className="cifras">
            <div className="cifra">
              <strong>{numero(u.compras.pagadas)}</strong>
              <span>pagadas</span>
            </div>
            <div className="cifra">
              <strong>{formatPrice(Number(u.compras.monto))}</strong>
              <span>gastado (sin reembolsos totales)</span>
            </div>
            <div className="cifra">
              <strong>{u.compras.ultima ? haceCuanto(u.compras.ultima) : '—'}</strong>
              <span>última compra</span>
            </div>
          </div>
        </section>
      </div>

      <div className="admin-bloques">
        <section className="card stack">
          <h2>Tiendas propias</h2>
          {u.tiendas.length === 0 ? (
            <p className="muted">No tiene tiendas.</p>
          ) : (
            <ListaScroll as="ul" className="lista-simple" etiqueta="Tiendas propias" alto="22rem">
              {u.tiendas.map((t) => (
                <li key={t.id} className="fila-con-estado">
                  <span>
                    {veoTiendas ? <Link href={`/admin/tiendas/${t.id}`}>{t.nombre}</Link> : <strong>{t.nombre}</strong>}{' '}
                    <span className="muted">· {t.plan ?? 'sin plan'}</span>
                  </span>
                  <StoreStatus estado={t.estado} />
                </li>
              ))}
            </ListaScroll>
          )}
        </section>

        <section className="card stack">
          <h2>Trabaja en</h2>
          {u.equipos.length === 0 ? (
            <p className="muted">No es empleado de ninguna tienda.</p>
          ) : (
            <ListaScroll as="ul" className="lista-simple" etiqueta="Tiendas donde trabaja" alto="22rem">
              {u.equipos.map((m) => (
                <li key={m.tienda.id}>
                  <strong>{m.tienda.nombre}</strong>{' '}
                  <span className="muted">
                    · {m.rol}
                    {m.estado !== 'activo' ? ` · ${m.estado}` : ''}
                  </span>
                </li>
              ))}
            </ListaScroll>
          )}
        </section>
      </div>

      <section className="card stack">
        <h2>Últimas compras</h2>
        {u.ultimasCompras.length === 0 ? (
          <p className="muted">Todavía no compró nada.</p>
        ) : (
          <ListaScroll as="ul" className="lista-simple" etiqueta="Últimas compras" alto="22rem">
            {u.ultimasCompras.map((c) => (
              <li key={c.id} className="fila-con-estado">
                <span>
                  <Link href={`/admin/pedidos/${c.id}`}>Pedido #{c.numero}</Link>{' '}
                  <span className="muted">
                    · {formatDate(c.creado_en)} · {c.tiendas?.join(', ')}
                  </span>
                </span>
                <span>
                  <strong>{formatPrice(Number(c.total))}</strong>{' '}
                  <span className="muted">· {ESTADO_PAGO[c.estado_pago]}</span>
                </span>
              </li>
            ))}
          </ListaScroll>
        )}
      </section>

      <section className="card stack">
        <h2>Historial de bloqueos</h2>
        {u.historialBloqueos.length === 0 ? (
          <p className="muted">Nunca se bloqueó.</p>
        ) : (
          <ListaScroll as="ol" className="historial" etiqueta="Historial de bloqueos" alto="22rem">
            {u.historialBloqueos.map((h) => (
              <li key={h.bloqueado_en}>
                <time className="muted" dateTime={h.bloqueado_en}>
                  {fechaHora(h.bloqueado_en)}
                </time>
                <p>
                  Bloqueada{h.bloqueadoPor && <span className="muted"> · por {h.bloqueadoPor}</span>}
                </p>
                <p className="muted">Motivo: {h.motivo}</p>
                {h.desbloqueado_en && (
                  <p>
                    Desbloqueada el {fechaHora(h.desbloqueado_en)}
                    {h.desbloqueadoPor && <span className="muted"> · por {h.desbloqueadoPor}</span>}
                    {h.nota && <span className="muted"> · {h.nota}</span>}
                  </p>
                )}
              </li>
            ))}
          </ListaScroll>
        )}
      </section>
    </div>
  );
}
