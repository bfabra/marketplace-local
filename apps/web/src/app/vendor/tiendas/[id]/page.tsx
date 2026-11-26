'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, type Direccion, type Tienda } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { verTelefono } from '@/lib/telefonos';
import { iniciales } from '@/lib/visual';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { ModalEditarDatosPersonales } from '@/components/vendor/modal-editar-datos-personales';
import { ModalRegistrarTienda } from '@/components/vendor/modal-registrar-tienda';

function textoDireccionPersonal(d: Direccion | null) {
  if (!d) return '—';
  const piso = d.piso_depto ? `, ${d.piso_depto}` : '';
  return `${d.calle} ${d.numero}${piso}, ${d.localidad.nombre}`;
}

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

const MENSAJE_APROBACION: Record<string, string> = {
  activa: 'Tu tienda está aprobada y visible para todos.',
  pendiente:
    'Tu tienda ya está cargada, pero no es pública todavía. Un superadmin tiene que aprobarla desde el panel de administración.',
  suspendida: 'Tu tienda fue suspendida. Resolvé el motivo indicado y contactá a soporte para reactivarla.',
  vencida: 'La suscripción venció. Renová el plan para volver a mostrar tu tienda.',
  archivada: 'Esta tienda está archivada.',
};

/** Panel #merchant-panel → Perfil Comerciante. */
export default function StorePanelPage({ params }: { params: { id: string } }) {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [fichas, setFichas] = useState<Record<string, Tienda>>({});
  const [direccionPersonal, setDireccionPersonal] = useState<Direccion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [modalTiendaAbierto, setModalTiendaAbierto] = useState(false);
  const [modalPerfilAbierto, setModalPerfilAbierto] = useState(false);
  const [tiendaEditando, setTiendaEditando] = useState<Tienda | null>(null);
  const [abriendoEdicion, setAbriendoEdicion] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

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

  useEffect(() => {
    let vivo = true;
    api<Direccion[]>('/addresses')
      .then((lista) => {
        if (!vivo) return;
        setDireccionPersonal(lista.find((d) => d.es_principal) ?? lista[0] ?? null);
      })
      .catch(() => {
        if (vivo) setDireccionPersonal(null);
      });
    return () => {
      vivo = false;
    };
  }, []);

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

async function eliminarSucursal(id: string, nombre: string) {
    const vigentes = (user?.tiendas ?? []).filter((t) => t.estado !== 'archivada');
    if (vigentes.length < 2) return;
    if (!window.confirm(`¿Eliminar la sucursal "${nombre}"? Dejará de aparecer en tu panel.`)) return;
    setEliminando(id);
    setError(null);
    try {
      await api(`/stores/${id}`, { method: 'DELETE' });
      await refresh();
      if (id === params.id) {
        const otra = vigentes.find((t) => t.id !== id);
        router.push(otra ? `/vendor/tiendas/${otra.id}` : '/vendor');
        return;
      }
      setFichas((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo eliminar la sucursal');
    } finally {
      setEliminando(null);
    }
  }


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
  const misTiendas = (user?.tiendas ?? []).filter((t) => t.estado !== 'archivada');
  const puedeEliminarSucursal = misTiendas.length > 1;

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
          <button type="button" className="mp-btn-editar" onClick={() => setModalPerfilAbierto(true)}>
            <Icon name="pencil" size={14} /> Editar datos personales
          </button>
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
            <span>CUIT / CUIL</span>
            <strong>{user?.dni || '—'}</strong>
          </div>
          <div>
            <span>Dirección Personal</span>
            <strong>{textoDireccionPersonal(direccionPersonal)}</strong>
          </div>
          <div>
            <span>Teléfono Personal</span>
            <strong>{user?.telefono || '—'}</strong>
          </div>
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
          {/* Maqueta #merchant-panel: mismo modal add/edit-store */}
          <button
            type="button"
            className="mp-btn-crear mp-btn-nueva-tienda"
            onClick={() => {
              setTiendaEditando(null);
              setModalTiendaAbierto(true);
            }}
          >
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
            const telefonosTxt =
              ficha?.telefonos?.length
                ? ficha.telefonos.map(verTelefono).join(' · ')
                : ficha?.telefono
                  ? `Tel: ${ficha.telefono}`
                  : null;
            const puedeEditarEsta =
              actual ? puedeEditar || tienda.esDuenio : true;
            const estado = actual ? tienda.estado : t.estado;

            return (
              <article key={t.id} className={`mp-tienda-card${actual ? ' is-actual' : ''}`}>
                <span className={`mp-tienda-badge mp-tienda-badge-${estado}`}>
                  {ESTADO_TIENDA[estado] ?? estado}
                </span>
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
                  {telefonosTxt && <span>{telefonosTxt.startsWith('Tel:') ? telefonosTxt : `Tel: ${telefonosTxt}`}</span>}
                  {direccion && <span>{direccion}</span>}
                </div>
                <div className="mp-tienda-card-acciones">
                  {/* Maqueta: Editar abre el mismo popup que Registrar; Eliminar si hay más de una */}
                  {puedeEditarEsta ? (
                    <button
                      type="button"
                      className="mp-tienda-btn"
                      disabled={abriendoEdicion === t.id || eliminando === t.id}
                      onClick={async () => {
                        const lista = fichas[t.id] ?? (actual ? tienda : null);
                        if (lista) {
                          setTiendaEditando(lista);
                          setModalTiendaAbierto(true);
                          return;
                        }
                        setAbriendoEdicion(t.id);
                        try {
                          const f = await api<Tienda>(`/stores/${t.id}`);
                          setFichas((prev) => ({ ...prev, [f.id]: f }));
                          setTiendaEditando(f);
                          setModalTiendaAbierto(true);
                        } catch (e) {
                          setError(e instanceof ApiError ? e.message : 'No se pudo abrir la tienda');
                        } finally {
                          setAbriendoEdicion(null);
                        }
                      }}
                    >
                      {abriendoEdicion === t.id ? 'Abriendo…' : 'Editar'}
                    </button>
                  ) : (
                    <span className="mp-tienda-btn is-disabled" title="Sin permiso para editar esta tienda">
                      Editar
                    </span>
                  )}
                  {(actual ? tienda.esDuenio : t.rol === 'propietario' || fichas[t.id]?.esDuenio) && (
                    <button
                      type="button"
                      className="mp-tienda-btn peligro"
                      disabled={eliminando === t.id || !puedeEliminarSucursal}
                      title={
                        puedeEliminarSucursal
                          ? 'Eliminar esta sucursal'
                          : 'Registrá otra sucursal para poder eliminar esta'
                      }
                      onClick={() => eliminarSucursal(t.id, nombre)}
                    >
                      {eliminando === t.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
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
                      Gestionar esta tienda
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>


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
            <button
              type="button"
              className="mp-btn-editar"
              onClick={() => {
                setTiendaEditando(tienda);
                setModalTiendaAbierto(true);
              }}
            >
              Elegir rubro
            </button>
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



      <ModalEditarDatosPersonales
        abierto={modalPerfilAbierto}
        direccion={direccionPersonal}
        onCerrar={() => setModalPerfilAbierto(false)}
        onGuardado={(_u, dir) => {
          setDireccionPersonal(dir);
        }}
      />
      <ModalRegistrarTienda
        key={tiendaEditando?.id ?? 'nueva'}
        abierto={modalTiendaAbierto}
        tienda={tiendaEditando}
        onCerrar={() => {
          setModalTiendaAbierto(false);
          setTiendaEditando(null);
        }}
        onGuardado={(guardada) => {
          setFichas((prev) => ({ ...prev, [guardada.id]: guardada }));
          if (guardada.id === params.id) setTienda(guardada);
          cargar();
        }}
      />
    </div>
  );
}
