'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiError, api, type LocalidadAdmin, type TerritorioAdmin } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/empty-state';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { EncabezadoAdmin } from '@/components/admin/encabezado';
import { BotonConfirmar, Buscador, EditarTexto, numero } from '@/components/admin/controles';

const mensaje = (e: unknown) => (e instanceof ApiError ? e.message : 'Error inesperado');
const plural = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`;
const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function AdminLocationsPage() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <Ubicaciones />
    </Suspense>
  );
}

function Ubicaciones() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const provinciaUrl = params.get('provincia') ?? '';

  const [datos, setDatos] = useState<TerritorioAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nuevaProvincia, setNuevaProvincia] = useState(false);
  const [renombrando, setRenombrando] = useState(false);
  const [filtro, setFiltro] = useState('');

  const ultimaConsulta = useRef(0);
  const cargar = useCallback(() => {
    const consulta = ++ultimaConsulta.current;
    const q = provinciaUrl ? `?provincia=${provinciaUrl}` : '';
    api<TerritorioAdmin>(`/admin/territorio${q}`)
      .then((d) => consulta === ultimaConsulta.current && setDatos(d))
      .catch((e) => setError(mensaje(e)));
  }, [provinciaUrl]);

  useEffect(cargar, [cargar]);

  const elegir = (id: string) => {
    setRenombrando(false);
    setFiltro('');
    router.replace(`${pathname}?provincia=${id}`, { scroll: false });
  };

  async function accion(fn: () => Promise<unknown>, aviso?: { titulo: string; texto: string }) {
    setError(null);
    try {
      await fn();
      if (aviso) toast(aviso);
      cargar();
      return true;
    } catch (e) {
      setError(mensaje(e));
      return false;
    }
  }

  const provincia = datos?.provincia ?? null;
  const resumen = datos?.provincias.find((p) => p.id === provincia?.id);
  const localidades = (datos?.localidades ?? []).filter((l) => !filtro || sinTildes(l.nombre).includes(sinTildes(filtro)));

  return (
    <div className="stack">
      <EncabezadoAdmin
        titulo="Provincias y localidades"
        descripcion="Dónde opera la plataforma y cuánto cuesta el envío a cada localidad."
      >
        {!nuevaProvincia && (
          <button className="btn btn-secondary" onClick={() => setNuevaProvincia(true)}>
            <Icon name="plus" size={18} /> Nueva provincia
          </button>
        )}
      </EncabezadoAdmin>

      {nuevaProvincia && (
        <div className="card stack">
          <h2>Nueva provincia</h2>
          <p className="muted">Nace inactiva: sumale localidades y activala cuando esté lista.</p>
          <EditarTexto
            valor=""
            label="Nombre de la provincia"
            onCancelar={() => setNuevaProvincia(false)}
            onGuardar={async (nombre) => {
              const p = await api<{ id: string; nombre: string }>('/admin/provincias', {
                method: 'POST',
                body: { nombre },
              });
              setNuevaProvincia(false);
              toast({ titulo: 'Provincia creada', texto: `Sumale localidades a ${p.nombre}.` });
              elegir(p.id);
            }}
          />
        </div>
      )}

      {datos && datos.sinEnvio > 0 && (
        <p className="aviso-banda aviso-advertencia">
          <Icon name="truck" size={18} />
          {plural(datos.sinEnvio, 'localidad activa no tiene', 'localidades activas no tienen')} tarifa de envío: los
          compradores de ahí no pueden pedir entrega a domicilio.
        </p>
      )}

      {error && <Alert>{error}</Alert>}

      {!datos ? (
        <p>Cargando…</p>
      ) : datos.provincias.length === 0 || !provincia ? (
        <EmptyState icono="pin" titulo="Todavía no hay provincias">
          Creá la primera para empezar a cargar localidades.
        </EmptyState>
      ) : (
        <>
          <div className="tabs" role="group" aria-label="Provincia">
            {datos.provincias.map((p) => (
              <button
                key={p.id}
                className={p.activa ? 'tab' : 'tab tab-inactiva'}
                aria-pressed={p.id === provincia.id}
                onClick={() => elegir(p.id)}
              >
                {p.nombre}
                <span className="tab-cuenta" title="Localidades activas">
                  {numero(p.localidadesActivas)}
                </span>
              </button>
            ))}
          </div>

          <section className="card stack">
            <div className="bloque-head">
              {renombrando ? (
                <EditarTexto
                  valor={provincia.nombre}
                  label="Nuevo nombre de la provincia"
                  onCancelar={() => setRenombrando(false)}
                  onGuardar={async (nombre) => {
                    await api(`/admin/provincias/${provincia.id}`, { method: 'PUT', body: { nombre } });
                    setRenombrando(false);
                    toast({ titulo: 'Provincia renombrada', texto: `Ahora se llama ${nombre}.` });
                    cargar();
                  }}
                />
              ) : (
                <div>
                  <h2 className="titulo-con-badge">
                    {provincia.nombre}
                    <span className={provincia.activa ? 'badge badge-activa' : 'badge badge-archivada'}>
                      {provincia.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </h2>
                  {resumen && (
                    <p className="muted">
                      {plural(resumen.localidades, 'localidad', 'localidades')} ·{' '}
                      {plural(resumen.localidadesActivas, 'activa', 'activas')} ·{' '}
                      {plural(resumen.tiendas, 'tienda', 'tiendas')}
                    </p>
                  )}
                </div>
              )}
              {!renombrando && (
                <span className="actions">
                  <button className="btn btn-ghost" onClick={() => setRenombrando(true)}>
                    <Icon name="pencil" size={16} /> Renombrar
                  </button>
                  {provincia.activa ? (
                    <BotonConfirmar
                      label="Desactivar"
                      pregunta={`¿Desactivar ${provincia.nombre}?`}
                      confirmar="Sí, desactivar"
                      peligro
                      onConfirmar={() =>
                        accion(() => api(`/admin/provincias/${provincia.id}/activa`, { method: 'PATCH', body: { activa: false } }), {
                          titulo: 'Provincia desactivada',
                          texto: 'Las tiendas y direcciones que ya están ahí siguen funcionando.',
                        }).then(() => undefined)
                      }
                    />
                  ) : (
                    <button
                      className="btn"
                      disabled={!resumen?.localidadesActivas}
                      title={!resumen?.localidadesActivas ? 'Activá al menos una localidad antes' : undefined}
                      onClick={() =>
                        accion(() => api(`/admin/provincias/${provincia.id}/activa`, { method: 'PATCH', body: { activa: true } }), {
                          titulo: 'Provincia activa',
                          texto: `Ya se pueden elegir sus localidades activas.`,
                        })
                      }
                    >
                      Activar
                    </button>
                  )}
                </span>
              )}
            </div>
            <p className="muted">
              {provincia.activa
                ? 'Al desactivar una provincia o localidad deja de ofrecerse para tiendas y direcciones nuevas; las que ya están ahí siguen funcionando.'
                : 'Mientras esté inactiva, sus localidades no se ofrecen para tiendas ni direcciones nuevas.'}
            </p>

            <div className="admin-filtros">
              <NuevaLocalidad
                provincia={provincia}
                onCreada={(nombre) => {
                  toast({ titulo: 'Localidad agregada', texto: `${nombre} ya se puede elegir. Cargale la tarifa de envío.` });
                  cargar();
                }}
              />
              {datos.localidades.length > 8 && (
                <Buscador valor={filtro} placeholder="Buscar localidad" onCambio={setFiltro} />
              )}
            </div>

            {datos.localidades.length === 0 ? (
              <p className="muted">Todavía no tiene localidades.</p>
            ) : localidades.length === 0 ? (
              <p className="muted">Ninguna localidad coincide con «{filtro}».</p>
            ) : (
              <ListaScroll as="ul" className="localidades" etiqueta={`Localidades de ${provincia.nombre}`}>
                {localidades.map((l) => (
                  <Localidad key={l.id} provinciaId={provincia.id} localidad={l} onCambio={cargar} onError={setError} />
                ))}
              </ListaScroll>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function NuevaLocalidad({
  provincia,
  onCreada,
}: {
  provincia: { id: string; nombre: string };
  onCreada: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const limpio = nombre.trim();
    if (limpio.length < 2) {
      setError('Escribí al menos 2 caracteres.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await api(`/admin/provincias/${provincia.id}/localidades`, { method: 'POST', body: { nombre: limpio } });
      setNombre('');
      onCreada(limpio);
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="editar-texto" onSubmit={enviar} noValidate>
      <label className="sr-only" htmlFor="nueva-localidad">
        Nueva localidad en {provincia.nombre}
      </label>
      <input
        id="nueva-localidad"
        className="input"
        value={nombre}
        maxLength={60}
        placeholder={`Nueva localidad en ${provincia.nombre}`}
        aria-invalid={!!error}
        onChange={(e) => setNombre(e.target.value)}
      />
      <button className="btn btn-secondary" disabled={enviando}>
        <Icon name="plus" size={16} /> Agregar
      </button>
      {error && <small className="field-error">{error}</small>}
    </form>
  );
}

function Localidad({
  provinciaId,
  localidad: l,
  onCambio,
  onError,
}: {
  provinciaId: string;
  localidad: LocalidadAdmin;
  onCambio: () => void;
  onError: (mensaje: string | null) => void;
}) {
  const toast = useToast();
  const [renombrando, setRenombrando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const enUso = l.tiendas + l.direcciones;

  async function activar(activa: boolean) {
    setOcupado(true);
    onError(null);
    try {
      await api(`/admin/localidades/${l.id}/activa`, { method: 'PATCH', body: { activa } });
      toast(
        activa
          ? { titulo: 'Localidad activa', texto: `${l.nombre} ya se puede elegir.` }
          : { titulo: 'Localidad desactivada', texto: `${l.nombre} no se ofrece para tiendas ni direcciones nuevas.` }
      );
      onCambio();
    } catch (e) {
      onError(mensaje(e));
    } finally {
      setOcupado(false);
    }
  }

  async function borrar() {
    onError(null);
    try {
      await api(`/admin/localidades/${l.id}`, { method: 'DELETE' });
      toast({ titulo: 'Localidad borrada', texto: `${l.nombre} ya no existe.` });
      onCambio();
    } catch (e) {
      onError(mensaje(e));
    }
  }

  return (
    <li className={l.activa ? 'localidad' : 'localidad localidad-inactiva'}>
      <div className="localidad-info">
        {renombrando ? (
          <EditarTexto
            valor={l.nombre}
            label={`Nuevo nombre para ${l.nombre}`}
            onCancelar={() => setRenombrando(false)}
            onGuardar={async (nombre) => {
              await api(`/admin/provincias/${provinciaId}/localidades/${l.id}`, { method: 'PUT', body: { nombre } });
              setRenombrando(false);
              onCambio();
            }}
          />
        ) : (
          <>
            <strong>
              {l.nombre}
              {!l.activa && <span className="badge badge-archivada">Inactiva</span>}
            </strong>
            <span className="muted">
              {enUso === 0
                ? 'Sin tiendas ni direcciones'
                : [
                    l.tiendas > 0 && plural(l.tiendas, 'tienda', 'tiendas'),
                    l.direcciones > 0 && plural(l.direcciones, 'dirección', 'direcciones'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
          </>
        )}
      </div>

      <Tarifa localidad={l} onGuardada={onCambio} />

      <div className="localidad-acciones">
        <button
          className="icon-btn icon-btn-sm"
          aria-label={`Renombrar ${l.nombre}`}
          title="Renombrar"
          disabled={renombrando}
          onClick={() => setRenombrando(true)}
        >
          <Icon name="pencil" size={16} />
        </button>
        <button className="btn btn-ghost" disabled={ocupado} onClick={() => activar(!l.activa)}>
          {l.activa ? 'Desactivar' : 'Activar'}
        </button>
        {enUso === 0 && (
          <BotonConfirmar
            label={<Icon name="trash" size={16} />}
            className="icon-btn icon-btn-sm icon-btn-peligro"
            pregunta={`¿Borrar ${l.nombre}?`}
            confirmar="Sí, borrar"
            peligro
            onConfirmar={borrar}
          />
        )}
      </div>
    </li>
  );
}

function Tarifa({ localidad: l, onGuardada }: { localidad: LocalidadAdmin; onGuardada: () => void }) {
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [costo, setCosto] = useState('');
  const [activa, setActiva] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function abrir() {
    setCosto(l.tarifa ? String(l.tarifa.costo) : '');
    setActiva(l.tarifa?.activa ?? true);
    setError(null);
    setEditando(true);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const valor = Number(costo);
    if (costo.trim() === '' || !Number.isFinite(valor) || valor < 0) {
      setError('Ingresá un costo de 0 o más.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await api(`/admin/localidades/${l.id}/tarifa`, { method: 'PUT', body: { costo: valor, activa } });
      toast({
        titulo: 'Tarifa guardada',
        texto: activa ? `El envío a ${l.nombre} cuesta ${formatPrice(valor)}.` : `Pausaste los envíos a ${l.nombre}.`,
      });
      setEditando(false);
      onGuardada();
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setEnviando(false);
    }
  }

  if (editando) {
    return (
      <form className="tarifa-form" onSubmit={enviar} noValidate>
        <label className="field">
          Costo de envío ($)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="50"
            value={costo}
            autoFocus
            aria-invalid={!!error}
            onChange={(e) => setCosto(e.target.value)}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
          Hacemos envíos acá
        </label>
        <span className="actions">
          <button className="btn" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </span>
        {error && <small className="field-error">{error}</small>}
      </form>
    );
  }

  return (
    <div className="tarifa">
      {l.tarifa?.activa ? (
        <span>
          <Icon name="truck" size={16} /> Envío {formatPrice(l.tarifa.costo)}
        </span>
      ) : l.tarifa ? (
        <span className="muted">Envío pausado ({formatPrice(l.tarifa.costo)})</span>
      ) : (
        <span className={l.activa ? 'tarifa-falta' : 'muted'}>Sin tarifa de envío</span>
      )}
      <button className="btn-link" onClick={abrir}>
        {l.tarifa ? 'Cambiar' : 'Cargar tarifa'}
      </button>
    </div>
  );
}
