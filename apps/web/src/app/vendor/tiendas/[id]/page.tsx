'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, type Tienda } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { fullName } from '@/lib/utils';
import { iniciales } from '@/lib/visual';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { ModalRegistrarTienda } from '@/components/vendor/modal-registrar-tienda';

const ESTADO_TIENDA: Record<string, string> = {
  pendiente: 'En revisión',
  activa: 'Activa',
  suspendida: 'Suspendida',
  vencida: 'Vencida',
  archivada: 'Archivada',
};

function Paso({ hecho, numero, titulo, children }: { hecho: boolean; numero: number; titulo: string; children?: React.ReactNode }) {
  return (
    <li>
      <span className={`check-icon${hecho ? ' hecho' : ''}`} aria-hidden>
        {hecho ? '✓' : numero}
      </span>
      <div>
        <strong>{titulo}</strong>
        {children}
      </div>
    </li>
  );
}

const nombrePlan = (nombre: string) => (/^plan\b/i.test(nombre) ? nombre : `Plan ${nombre}`);
const fechaLarga = (f: string) => new Date(f).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

const MENSAJE_APROBACION: Record<string, string> = {
  activa: 'Tu tienda está aprobada y visible para todos.',
  pendiente: 'Cuando completes los pasos anteriores, el equipo de Tu Comercio Local revisa tus datos y la aprueba.',
  suspendida: 'Tu tienda fue suspendida. Resolvé el motivo indicado y contactá a soporte para reactivarla.',
  vencida: 'La suscripción venció. Renová el plan para volver a mostrar tu tienda.',
  archivada: 'Esta tienda está archivada.',
};

/** Panel #merchant-panel → Perfil Comerciante. */
export default function StorePanelPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [fichas, setFichas] = useState<Record<string, Tienda>>({});
  const [error, setError] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [modalNuevaTienda, setModalNuevaTienda] = useState(false);

  const cargar = useCallback(() => {
    api<Tienda>(`/stores/${params.id}`)
      .then((t) => {
        setTienda(t);
        setFichas((prev) => ({ ...prev, [t.id]: t }));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Fichas de las otras sucursales para armar las tarjetas como en la maqueta.
  useEffect(() => {
    const ids = (user?.tiendas ?? []).map((t) => t.id).filter((id) => id !== params.id);
    if (!ids.length) return;
    let cancelado = false;
    Promise.all(
      ids.map((id) =>
        api<Tienda>(`/stores/${id}`)
          .then((t) => [id, t] as const)
          .catch(() => null)
      )
    ).then((pares) => {
      if (cancelado) return;
      setFichas((prev) => {
        const next = { ...prev };
        for (const p of pares) if (p) next[p[0]] = p[1];
        return next;
      });
    });
    return () => {
      cancelado = true;
    };
  }, [user?.tiendas, params.id]);

  async function vincularPrueba() {
    setVinculando(true);
    setError(null);
    try {
      setTienda(await api<Tienda>(`/stores/${params.id}/mercadopago/prueba`, { method: 'POST' }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setVinculando(false);
    }
  }

  if (error && !tienda) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href="/vendor">Volver a mis tiendas</Link>
      </div>
    );
  }
  if (!tienda) return <PageSkeleton />;

  const base = `/vendor/tiendas/${tienda.id}`;
  const puedeEditar = tienda.permisos.includes('configuracion.editar');
  const activa = tienda.estado === 'activa';
  const pasosHechos = 1 + Number(!!tienda.plan) + Number(tienda.mercadoPago.vinculada) + Number(activa);
  const rubroTxt = tienda.rubro?.nombre ?? 'Sin rubro';
  const dirTxt = tienda.direccion;
  const misTiendas = user?.tiendas ?? [];

  return (
    <div className="mp-perfil">
      <section className="mp-panel-perfil">
        <div className="mp-panel-perfil-cabecera">
          <div>
            <h2>Datos Personales del Comerciante</h2>
            <p className="mp-panel-perfil-desc">
              Información de contacto del titular responsable de las tiendas.
            </p>
          </div>
          <Link href="/cuenta" className="mp-btn-editar">
            <Icon name="pencil" size={14} /> Editar datos personales
          </Link>
        </div>
        <div className="mp-datos-grid">
          <div>
            <span>Nombre</span>
            <strong>{user?.nombre || '—'}</strong>
          </div>
          <div>
            <span>Apellido</span>
            <strong>{user?.apellido || '—'}</strong>
          </div>
          <div>
            <span>DNI</span>
            <strong>{user?.dni || '—'}</strong>
          </div>
          <div>
            <span>Correo</span>
            <strong>{user?.email || '—'}</strong>
          </div>
          <div>
            <span>Teléfono personal</span>
            <strong>{user?.telefono || '—'}</strong>
          </div>
          {user?.nombre && user?.apellido && (
            <div>
              <span>Titular</span>
              <strong>{fullName(user.nombre, user.apellido)}</strong>
            </div>
          )}
        </div>
      </section>

      <section className="mp-panel-perfil">
        <div className="mp-panel-perfil-cabecera">
          <div>
            <h2>Mis Tiendas y Sucursales Registradas</h2>
            <p className="mp-panel-perfil-desc">
              Administrá tus locales, puntos de venta o agregá nuevas sucursales en San Juan.
            </p>
          </div>
          {/* Maqueta #merchant-panel: abre modal add-store, no navega a onboarding */}
          <button type="button" className="mp-btn-crear mp-btn-nueva-tienda" onClick={() => setModalNuevaTienda(true)}>
            + Registrar Nueva Tienda
          </button>
        </div>

        <div className="mp-tiendas-grid">
          {misTiendas.map((t) => {
            const actual = t.id === tienda.id;
            const ficha = fichas[t.id];
            const nombre = ficha?.nombre ?? t.nombre;
            const cuit = ficha?.cuit;
            const logo = ficha?.logo;
            const rubro =
              ficha?.rubro?.nombre != null
                ? `${ficha.rubro.nombre}${ficha.subrubro ? ` · ${ficha.subrubro.nombre}` : ''}`
                : actual
                  ? rubroTxt
                  : null;
            const direccion = ficha
              ? `${ficha.direccion}, ${ficha.localidad.nombre}`
              : actual
                ? `${dirTxt}, ${tienda.localidad.nombre}`
                : null;
            const telefono = ficha?.telefonos?.[0]
              ? `${ficha.telefonos[0].pais} ${ficha.telefonos[0].numero}`
              : ficha?.telefono;
            const puedeEditarEsta =
              actual ? puedeEditar || tienda.esDuenio : true;

            return (
              <article key={t.id} className={`mp-tienda-card${actual ? ' is-actual' : ''}`}>
                {actual && <span className="mp-tienda-badge">Activa</span>}
                <div className="mp-tienda-card-top">
                  <span className="mp-tienda-card-logo" aria-hidden="true">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="" />
                    ) : (
                      iniciales(nombre)
                    )}
                  </span>
                  <div>
                    <strong>{nombre}</strong>
                    <span className="mp-tienda-cuit">CUIT: {cuit || 'N/D'}</span>
                  </div>
                </div>
                <div className="mp-tienda-card-meta">
                  {rubro && <span>{rubro}</span>}
                  {direccion && <span>{direccion}</span>}
                  {telefono && <span>Tel: {telefono}</span>}
                  {!actual && !ficha && (
                    <span className="muted">{ESTADO_TIENDA[t.estado] ?? t.estado}</span>
                  )}
                </div>
                <div className="mp-tienda-card-acciones">
                  {/* Maqueta: Editar siempre visible → datos de la sucursal */}
                  {puedeEditarEsta ? (
                    <Link href={`/vendor/tiendas/${t.id}/datos`} className="mp-tienda-btn">
                      Editar
                    </Link>
                  ) : (
                    <span className="mp-tienda-btn is-disabled" title="Sin permiso para editar esta tienda">
                      Editar
                    </span>
                  )}
                </div>
                <div className="mp-tienda-card-pie">
                  {actual ? (
                    <span className="mp-tienda-en-gestion">Tienda actualmente en gestión</span>
                  ) : (
                    <button
                      type="button"
                      className="mp-tienda-btn primaria mp-tienda-seleccionar"
                      onClick={() => router.push(`/vendor/tiendas/${t.id}`)}
                    >
                      Seleccionar como Activa
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Publicar / carga masiva viven en Mis Productos (maqueta #merchant-panel → products) */}
      {(puedeEditar || tienda.esDuenio) && (
        <nav className="mp-anexos" aria-label="Acciones de la tienda">
          {puedeEditar && (
            <Link href={`${base}/datos`}>
              <Icon name="pencil" size={16} /> Datos de la tienda
            </Link>
          )}
          {tienda.esDuenio && (
            <Link href={`${base}/plan`}>
              <Icon name="sparkles" size={16} /> Plan
            </Link>
          )}
          <Link href="/vendor">
            <Icon name="store" size={16} /> Mis tiendas
          </Link>
        </nav>
      )}

      {error && <Alert>{error}</Alert>}
      {(tienda.estado === 'suspendida' || tienda.estado === 'archivada') && tienda.motivo_estado && (
        <Alert>
          <strong>Motivo indicado por Tu Comercio Local:</strong> {tienda.motivo_estado}
        </Alert>
      )}
      {!tienda.rubro && (
        <section className="card pt-aviso-rubro" role="status">
          <span className="pt-cifra-icono" aria-hidden>
            <Icon name="tag" size={20} />
          </span>
          <div>
            <strong>Elegí el rubro de tu negocio</strong>
            <p className="muted">
              Ahora cada tienda declara su rubro: así aparece bien clasificada y los clientes entienden qué ofrecés.
              {!puedeEditar && ' Pedile a quien administra la tienda que lo complete.'}
            </p>
          </div>
          {puedeEditar && (
            <Link href={`${base}/datos`} className="btn btn-accent">
              Elegir rubro
            </Link>
          )}
        </section>
      )}

      {!activa && (
        <section className="card pt-activar">
          <div className="pt-card-head">
            <h2>Pasos para activar tu tienda</h2>
            <span className="muted">{pasosHechos} de 4 listos</span>
          </div>
          <div className="pt-barra" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={pasosHechos}>
            <span style={{ width: `${(pasosHechos / 4) * 100}%` }} />
          </div>
          <ol className="checklist">
            <Paso hecho numero={1} titulo="Datos de la tienda cargados" />
            <Paso hecho={!!tienda.plan} numero={2} titulo={tienda.plan ? nombrePlan(tienda.plan.nombre) : 'Sin plan vigente'}>
              {tienda.plan && (
                <p className="muted">
                  Hasta {tienda.plan.max_productos ?? 'ilimitados'} productos publicados
                  {tienda.plan.max_empleados === 0 ? ', sin empleados.' : '.'}
                </p>
              )}
            </Paso>
            <Paso hecho={tienda.mercadoPago.vinculada} numero={3} titulo="Vincular Mercado Pago">
              {tienda.mercadoPago.vinculada ? (
                <p className="muted">
                  Cuenta vinculada{tienda.mercadoPago.esPrueba ? ' (de prueba, solo para desarrollo)' : ''}.
                </p>
              ) : tienda.esDuenio && tienda.mpPruebaDisponible ? (
                <>
                  <p className="muted">
                    Es donde vas a cobrar tus ventas. En desarrollo se simula con una cuenta de prueba;
                    en producción acá va la conexión real con Mercado Pago.
                  </p>
                  <button className="btn btn-secondary" onClick={vincularPrueba} disabled={vinculando}>
                    {vinculando ? 'Vinculando…' : 'Vincular cuenta de prueba'}
                  </button>
                </>
              ) : (
                <p className="muted">El dueño de la tienda tiene que vincular su cuenta.</p>
              )}
            </Paso>
            <Paso hecho={false} numero={4} titulo="Aprobación de Tu Comercio Local">
              <p className="muted">{MENSAJE_APROBACION[tienda.estado]}</p>
            </Paso>
          </ol>
        </section>
      )}

      {tienda.esDuenio && (
        <section className="card">
          <div className="pt-card-head">
            <h2>
              <Icon name="users" size={20} /> Plan y equipo
            </h2>
          </div>
          {tienda.plan ? (
            <>
              <p className="pt-uso">
                <strong>{nombrePlan(tienda.plan.nombre)}</strong>
              </p>
              <p className="muted">
                {tienda.plan.max_empleados === 0
                  ? 'No incluye empleados. Cambiá de plan para sumar a tu equipo.'
                  : tienda.plan.max_empleados === null
                    ? 'Empleados ilimitados.'
                    : `Hasta ${tienda.plan.max_empleados} empleados.`}
                {!tienda.plan.es_gratis && tienda.plan.fin_periodo
                  ? ` Se renueva el ${fechaLarga(tienda.plan.fin_periodo)}.`
                  : ''}
              </p>
            </>
          ) : (
            <p className="muted">La tienda no tiene un plan vigente.</p>
          )}
          <div className="actions pt-al-pie">
            <Link href={`${base}/equipo`} className="btn">
              Administrar equipo
            </Link>
            <Link href={`${base}/plan`} className="btn btn-secondary">
              Cambiar plan
            </Link>
          </div>
        </section>
      )}

      <p className="mp-atajo-ventas">
        <Link href={`${base}/ventas`}>
          Ver mis ventas y métricas <Icon name="arrow-right" size={15} />
        </Link>
      </p>

      <ModalRegistrarTienda abierto={modalNuevaTienda} onCerrar={() => setModalNuevaTienda(false)} />
    </div>
  );
}
