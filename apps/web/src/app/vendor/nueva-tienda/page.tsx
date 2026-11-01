'use client';

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ApiError,
  api,
  type DatosTienda,
  type Localidad,
  type LugarGoogle,
  type OpcionRubro,
  type TelefonoTienda,
  type Tienda,
  type Ubicacion,
} from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useOpciones } from '@/hooks/use-opciones';
import { TIPOS_TELEFONO, enlaceTelefono, telefonoVacio, telefonosCargados, validarTelefonos, verTelefono } from '@/lib/telefonos';
import { Icon } from '@/components/ui/icon';
import { BRAND_NAME } from '@/components/layout/logo';
import { useFormErrors } from '@/components/forms/use-form-errors';
import { AvisoDisenio, CampoDisenio, SelectorDisenio } from '@/components/forms/campo-disenio';
import { TelefonosTienda } from '@/components/forms/telefonos-tienda';
import { MapaTienda, UbicacionTienda } from '@/components/forms/ubicacion-tienda';

type Paso = 'datos' | 'revisar' | 'listo';

const MAX_DESCRIPCION = 500;
const MAX_LOGO = 5 * 1024 * 1024;
const TIPOS_LOGO = ['image/jpeg', 'image/png', 'image/webp'];

const VACIO = {
  nombre: '',
  cuit: '',
  razon_social: '',
  telefonos: [telefonoVacio()] as TelefonoTienda[],
  ubicacion: null as Ubicacion | null,
  email: '',
  descripcion: '',
  localidad_id: '',
  direccion: '',
  rubro_id: '',
  subrubro_id: '',
  especialidades: [] as string[],
};
type Borrador = typeof VACIO;
type CampoTexto = { [K in keyof Borrador]: Borrador[K] extends string ? K : never }[keyof Borrador];

/** 20123456786 → 20-12345678-6 mientras se escribe. */
function formatearCuit(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** Lo mínimo para pasar a revisar; el resto lo valida el API al crear. */
function validar(b: Borrador) {
  const errores: Record<string, string> = {};
  if (b.nombre.trim().length < 3) errores.nombre = 'El nombre debe tener al menos 3 caracteres';
  if (b.cuit.replace(/\D/g, '').length !== 11) errores.cuit = 'El CUIT son 11 números, por ejemplo 20-12345678-6';
  if (!b.rubro_id) errores.rubro_id = 'Elegí el rubro principal de tu negocio';
  if (!b.localidad_id) errores.localidad_id = 'Elegí una localidad';
  if (b.direccion.trim().length < 5) errores.direccion = 'Ingresá la dirección del local';
  return { ...errores, ...validarTelefonos(b.telefonos) };
}

function Pasos({ actual }: { actual: 2 | 3 }) {
  return (
    <div className="flow-stepper" role="list" aria-label="Progreso">
      {['Cuenta', 'Mi comercio', 'Finalizar'].map((etiqueta, i) => {
        const n = i + 1;
        const estado = n < actual ? 'completed' : n === actual ? 'active' : '';
        return (
          <div key={etiqueta} className={`flow-step ${estado}`} role="listitem" aria-current={n === actual ? 'step' : undefined}>
            <span>{n < actual ? <Icon name="check" size={13} /> : n}</span>
            <small>{etiqueta}</small>
            {i < 2 && <i />}
          </div>
        );
      })}
    </div>
  );
}

function Marco({ children, ancho = false }: { children: ReactNode; ancho?: boolean }) {
  return (
    <div className="flow-screen">
      <div className="simple-header">
        <Link href="/" className="official-logo" aria-label={`${BRAND_NAME}, ir al inicio`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logos/Negativo_logo_h_w.svg" width={250} height={31} alt="" />
        </Link>
        <span>
          ¿Preferís seguir comprando? <Link href="/">Volver al marketplace</Link>
        </span>
      </div>
      <main className={`flow-card${ancho ? ' wide' : ''}`}>{children}</main>
      <p className="legal-footer">© {new Date().getFullYear()} {BRAND_NAME}</p>
    </div>
  );
}

/** Alta de comercio: copia del flujo de la maqueta (docs/diseno, #merchant → #review → #success). */
export default function NewStorePage() {
  const { user, refresh } = useAuth();
  const opciones = useOpciones();
  const errors = useFormErrors();
  const [paso, setPaso] = useState<Paso>('datos');
  const [b, setB] = useState<Borrador>(VACIO);
  const [rubros, setRubros] = useState<OpcionRubro[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [logo, setLogo] = useState<{ archivo: File; url: string } | null>(null);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [creada, setCreada] = useState<{ tienda: Tienda; sinLogo: boolean } | null>(null);

  useEffect(() => {
    api<OpcionRubro[]>('/catalog/rubros').then(setRubros).catch(errors.set);
    api<Localidad[]>('/locations/localidades').then(setLocalidades).catch(errors.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (logo) URL.revokeObjectURL(logo.url);
    },
    [logo]
  );

  useEffect(() => {
    document.title = `Creá tu comercio · ${BRAND_NAME}`;
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [paso]);

  const poner = (campo: CampoTexto, valor: string) => {
    setB((actual) => ({ ...actual, [campo]: valor }));
    errors.dismiss(campo);
  };

  /** Completa con lo que trae Google Maps sin pisar lo que la persona ya escribió (salvo la dirección). */
  function importar(lugar: LugarGoogle) {
    setB((actual) => {
      const cargados = telefonosCargados(actual.telefonos);
      const yaEsta = lugar.telefono && cargados.some((t) => t.numero.replace(/\D/g, '') === lugar.telefono!.numero.replace(/\D/g, ''));
      return {
        ...actual,
        nombre: actual.nombre.trim() ? actual.nombre : lugar.nombre.slice(0, 80),
        direccion: lugar.direccion.slice(0, 200),
        localidad_id: lugar.localidad?.id ?? actual.localidad_id,
        ubicacion: lugar.ubicacion,
        telefonos: lugar.telefono && !yaEsta ? [...cargados, lugar.telefono].slice(0, 5) : actual.telefonos,
      };
    });
    ['nombre', 'direccion', 'localidad_id', 'telefonos'].forEach(errors.dismiss);
  }

  const rubro = rubros.find((r) => r.id === b.rubro_id);
  const subrubro = rubro?.subrubros.find((s) => s.id === b.subrubro_id);
  const localidad = localidades.find((l) => l.id === b.localidad_id);

  function elegirLogo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!TIPOS_LOGO.includes(archivo.type)) return setErrorLogo('El logo tiene que ser JPG, PNG o WEBP');
    if (archivo.size > MAX_LOGO) return setErrorLogo('El logo no puede pesar más de 5 MB');
    setErrorLogo(null);
    setLogo({ archivo, url: URL.createObjectURL(archivo) });
  }

  function continuar() {
    errors.clear();
    const encontrados = Object.entries(validar(b)).map(([path, message]) => ({ path, message }));
    if (encontrados.length > 0) {
      errors.set(new ApiError('Revisá los datos marcados en rojo', 400, encontrados));
      return;
    }
    setPaso('revisar');
  }

  async function crear() {
    setCreando(true);
    errors.clear();
    const datos: DatosTienda = {
      nombre: b.nombre,
      cuit: b.cuit,
      razon_social: b.razon_social,
      telefonos: b.telefonos,
      ubicacion: b.ubicacion,
      email: b.email,
      descripcion: b.descripcion,
      localidad_id: b.localidad_id,
      direccion: b.direccion,
      rubro_id: b.rubro_id,
      subrubro_id: b.subrubro_id || null,
      especialidades: b.especialidades,
    };
    try {
      const tienda = await api<Tienda>('/stores', { method: 'POST', body: datos });
      let sinLogo = false;
      if (logo) {
        const cuerpo = new FormData();
        cuerpo.append('foto', logo.archivo);
        sinLogo = !(await api(`/stores/${tienda.id}/imagen/logo`, { method: 'POST', body: cuerpo }).then(
          () => true,
          () => false
        ));
      }
      await refresh();
      setCreada({ tienda, sinLogo });
      setPaso('listo');
    } catch (error) {
      errors.set(error);
      setPaso('datos');
    } finally {
      setCreando(false);
    }
  }

  const f = errors.fields;

  if (paso === 'listo' && creada) {
    return (
      <Marco>
        <div className="success-illustration">
          <span>
            <Icon name="store" size={42} />
          </span>
          <i>
            <Icon name="check" size={24} />
          </i>
          <b />
          <b />
          <b />
        </div>
        <div className="form-heading centered success-heading">
          <span>TODO LISTO</span>
          <h2>¡Tu comercio está creado!</h2>
          <p>Ahora podés configurar tu tienda, publicar productos y prepararte para recibir pedidos.</p>
        </div>
        {creada.sinLogo && (
          <AvisoDisenio titulo="No pudimos subir el logo">Podés cargarlo desde los datos de tu tienda.</AvisoDisenio>
        )}
        <div className="success-list">
          <span>
            <i>
              <Icon name="check" size={13} />
            </i>
            Empezás con el plan Starter, sin costo
          </span>
          <span>
            <i>
              <Icon name="check" size={13} />
            </i>
            Vinculá Mercado Pago desde el panel para poder cobrar
          </span>
          <span>
            <i>
              <Icon name="check" size={13} />
            </i>
            El equipo revisa tu tienda y la publica en {BRAND_NAME}
          </span>
        </div>
        <div className="stack-actions">
          <Link href={`/vendor/tiendas/${creada.tienda.id}`} className="ds-btn primary">
            Ir a mi tienda <Icon name="arrow-right" size={17} />
          </Link>
          <Link href="/" className="ds-btn secondary">
            Explorar marketplace
          </Link>
        </div>
      </Marco>
    );
  }

  if (paso === 'revisar') {
    const detalle = [rubro?.nombre, subrubro?.nombre].filter(Boolean).join(' · ');
    const telefonos = telefonosCargados(b.telefonos);
    return (
      <Marco>
        <Pasos actual={3} />
        <div className="form-heading centered flow-heading">
          <span>ÚLTIMO PASO</span>
          <h2>Revisá los datos de tu comercio</h2>
          <p>Asegurate de que todo esté correcto antes de crearlo.</p>
        </div>
        <article className="store-review">
          <div className="store-cover" />
          <div className="store-content">
            <div className="store-logo">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.url} alt="" />
              ) : (
                <Icon name="store" size={28} />
              )}
            </div>
            <div className="store-title">
              <div>
                <h3>{b.nombre}</h3>
                <span>
                  CUIT: {b.cuit} · {detalle}
                </span>
              </div>
              <b>Vista previa</b>
            </div>
            <p>{b.descripcion || 'Sin descripción por ahora. Podés sumarla más adelante.'}</p>
            {(telefonos.length > 0 || b.email) && (
              <ul className="store-review-contacto">
                {telefonos.map((t, i) => (
                  <li key={i}>
                    <Icon name="phone" size={15} />{' '}
                    <a href={enlaceTelefono(t)} target={t.tipo === 'whatsapp' ? '_blank' : undefined} rel="noreferrer">
                      <strong>{verTelefono(t)}</strong>
                    </a>
                    <span className={`telefono-tipo ${t.tipo}`}>{TIPOS_TELEFONO[t.tipo]}</span>
                  </li>
                ))}
                {b.email && (
                  <li>
                    <Icon name="mail" size={15} /> {b.email}
                  </li>
                )}
              </ul>
            )}
            <div className="store-location">
              <Icon name="pin" size={18} />
              <div>
                <small>{b.ubicacion ? 'UBICACIÓN Y MAPA' : 'UBICACIÓN'}</small>
                <strong>{localidad ? `${localidad.nombre}, ${localidad.provincia}` : ''}</strong>
                <span>{b.direccion}</span>
              </div>
            </div>
            {b.ubicacion && <MapaTienda ubicacion={b.ubicacion} titulo={`Ubicación de ${b.nombre} en el mapa`} className="store-review-mapa" />}
          </div>
        </article>
        <div className="info-note">
          <Icon name="info" size={18} />
          <p>Podrás modificar esta información más adelante desde la configuración de tu tienda.</p>
        </div>
        <div className="stack-actions">
          <button type="button" className="ds-btn primary" onClick={crear} disabled={creando}>
            {creando ? (
              <>
                <span className="spinner" /> Creando tu comercio…
              </>
            ) : (
              <>
                Crear mi comercio <Icon name="arrow-right" size={17} />
              </>
            )}
          </button>
          <button type="button" className="ds-btn secondary" onClick={() => setPaso('datos')} disabled={creando}>
            Editar datos
          </button>
        </div>
      </Marco>
    );
  }

  return (
    <Marco ancho>
      <Pasos actual={2} />
      <div className="form-heading flow-heading">
        <span>CONFIGURÁ TU TIENDA</span>
        <h2>Creá tu comercio</h2>
        <p>Completá los datos legales, comerciales y de ubicación de tu tienda.</p>
      </div>
      {errors.message && <AvisoDisenio titulo="No pudimos continuar">{errors.message}</AvisoDisenio>}
      <div className="merchant-layout">
        <div className="merchant-fields">
          <CampoDisenio
            label="Nombre del comercio"
            icono="store"
            placeholder="Ej. Almacén Libertador"
            value={b.nombre}
            onChange={(e) => poner('nombre', e.target.value)}
            maxLength={80}
            error={f.nombre}
          />
          <div className="split-fields">
            <CampoDisenio
              label="CUIT / CUIL"
              icono="id"
              placeholder="Ej. 20381234563"
              inputMode="numeric"
              autoComplete="off"
              value={b.cuit}
              onChange={(e) => poner('cuit', formatearCuit(e.target.value))}
              error={f.cuit}
              ayuda="Solo números: los guiones se agregan solos."
            />
            <CampoDisenio
              label="Razón social (opcional)"
              icono="briefcase"
              placeholder="Como figura en AFIP"
              value={b.razon_social}
              onChange={(e) => poner('razon_social', e.target.value)}
              maxLength={120}
              error={f.razon_social}
            />
          </div>
          <TelefonosTienda
            valor={b.telefonos}
            onChange={(telefonos) => {
              setB((actual) => ({ ...actual, telefonos }));
              errors.dismiss('telefonos');
            }}
            errores={f}
          />
          <CampoDisenio
            label="Correo del comercio (opcional)"
            icono="mail"
            type="email"
            placeholder="ventas@tucomercio.com"
            value={b.email}
            onChange={(e) => poner('email', e.target.value)}
            error={f.email}
          />
          <div className="split-fields">
            <SelectorDisenio
              label="Rubro principal"
              name="rubro_id"
              value={b.rubro_id}
              onChange={(v) => {
                setB((actual) => ({ ...actual, rubro_id: v, subrubro_id: '', especialidades: [] }));
                errors.dismiss('rubro_id');
              }}
              placeholder={rubros.length ? 'Seleccioná un rubro' : 'Cargando…'}
              opciones={rubros.map((r) => ({ value: r.id, label: r.nombre }))}
              error={f.rubro_id}
            />
            <SelectorDisenio
              label="Subrubro (opcional)"
              name="subrubro_id"
              value={b.subrubro_id}
              onChange={(v) => setB((actual) => ({ ...actual, subrubro_id: v, especialidades: [] }))}
              placeholder={b.rubro_id ? 'Seleccioná un subrubro' : 'Primero elegí el rubro'}
              opciones={(rubro?.subrubros ?? []).map((s) => ({ value: s.id, label: s.nombre }))}
              disabled={!b.rubro_id}
              error={f.subrubro_id}
            />
          </div>
          {subrubro && subrubro.especialidades.length > 0 && (
            <div className="ds-field">
              <span>¿Qué ofrecés? (opcional)</span>
              <div className="chips merchant-chips" role="group" aria-label={`Especialidades de ${subrubro.nombre}`}>
                {subrubro.especialidades.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="chip"
                    aria-pressed={b.especialidades.includes(e.id)}
                    onClick={() =>
                      setB((actual) => ({
                        ...actual,
                        especialidades: actual.especialidades.includes(e.id)
                          ? actual.especialidades.filter((x) => x !== e.id)
                          : [...actual.especialidades, e.id],
                      }))
                    }
                  >
                    {e.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className={`ds-field${f.descripcion ? ' error' : ''}`}>
            <span>Descripción</span>
            <textarea
              value={b.descripcion}
              maxLength={MAX_DESCRIPCION}
              onChange={(e) => poner('descripcion', e.target.value)}
              placeholder="Contanos brevemente qué ofrecés y qué hace especial a tu comercio."
            />
            <small className="counter">
              {b.descripcion.length} / {MAX_DESCRIPCION}
            </small>
            {f.descripcion && <small role="alert">{f.descripcion}</small>}
          </label>
          <UbicacionTienda
            conGoogleMaps={!!opciones?.googleMaps}
            ubicacion={b.ubicacion}
            nombre={b.nombre}
            onImportar={importar}
            onQuitarUbicacion={() => setB((actual) => ({ ...actual, ubicacion: null }))}
          >
            <div className="split-fields">
              <SelectorDisenio
                label="Localidad"
                name="localidad_id"
                value={b.localidad_id}
                onChange={(v) => poner('localidad_id', v)}
                placeholder={localidades.length ? 'Seleccioná la localidad' : 'Cargando…'}
                opciones={localidades.map((l) => ({ value: l.id, label: `${l.nombre} (${l.provincia})` }))}
                error={f.localidad_id}
              />
              <CampoDisenio
                label="Dirección del local"
                icono="pin"
                placeholder="Ej. Av. San Martín 1240"
                value={b.direccion}
                onChange={(e) => poner('direccion', e.target.value)}
                maxLength={200}
                error={f.direccion}
              />
            </div>
          </UbicacionTienda>
        </div>
        <div className="upload-side">
          <label htmlFor="logo-comercio">Logo del comercio</label>
          <label htmlFor="logo-comercio" className={`upload-box${logo ? ' con-logo' : ''}`}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.url} alt="Vista previa del logo" />
            ) : (
              <span>
                <Icon name="upload" size={23} />
              </span>
            )}
            <strong>{logo ? 'Cambiar el logo' : 'Subí el logo de tu comercio'}</strong>
            <p>{logo ? logo.archivo.name : 'Hacé clic para buscar una imagen'}</p>
            <small>PNG, JPG o WEBP · Máx. 5 MB</small>
          </label>
          <input id="logo-comercio" type="file" accept={TIPOS_LOGO.join(',')} className="sr-only" onChange={elegirLogo} />
          {logo && (
            <button type="button" className="upload-quitar" onClick={() => setLogo(null)}>
              Quitar logo
            </button>
          )}
          {errorLogo && (
            <p className="upload-error" role="alert">
              {errorLogo}
            </p>
          )}
          <div className="upload-tip">
            <Icon name="info" size={17} />
            <p>Una imagen cuadrada y clara ayuda a que tu tienda se reconozca más rápido.</p>
          </div>
        </div>
      </div>
      <div className="flow-actions">
        <Link href={user?.tiendas.length ? '/vendor' : '/'} className="ds-btn secondary">
          <Icon name="chevron-left" size={17} /> Volver
        </Link>
        <button type="button" className="ds-btn primary" onClick={continuar}>
          Continuar <Icon name="arrow-right" size={17} />
        </button>
      </div>
    </Marco>
  );
}
