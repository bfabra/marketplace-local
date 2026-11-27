'use client';

import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, type Localidad, type TipoTelefono, type Usuario } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { safeNext } from '@/lib/redirect';
import { destinoAlIngresar } from '@/lib/equipo';
import {
  DIGITOS_TELEFONO_AR,
  PAISES,
  TIPOS_TELEFONO,
  armarTelefonoPerfil,
  prefijoTelefono,
  soloDigitosTelefono,
} from '@/lib/telefonos';
import { Icon } from '@/components/ui/icon';
import { BRAND_NAME, PRODUCT_NAME } from '@/components/layout/logo';
import { useFormErrors } from './use-form-errors';
import { AvisoDisenio, CampoDisenio, CasillaDisenio, SelectorDisenio } from './campo-disenio';
const PIN_CENTRO = { x: 50, y: 50, texto: 'Centro, San Juan (Predeterminado)' };

/** Crear cuenta: maqueta docs/diseno #signup (auth.js). */
export function RegisterForm() {
  const { register } = useAuth();
  const { carrito } = useCart();
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get('next');
  const next = safeNext(nextParam);
  const errors = useFormErrors();
  const [sending, setSending] = useState(false);
  /** undefined = formulario; string|null = cuenta creada (null = sin nombre). */
  const [creada, setCreada] = useState<string | null | undefined>(undefined);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [localidad, setLocalidad] = useState('');
  const [pais, setPais] = useState('+54');
  const [tipoTel, setTipoTel] = useState<TipoTelefono>('whatsapp');
  const [telefonoNum, setTelefonoNum] = useState('');
  const [dni, setDni] = useState('');
  const [pin, setPin] = useState(PIN_CENTRO);
  const prefijoTel = prefijoTelefono(pais, tipoTel);

  useEffect(() => {
    wakeRegistro();
    api<Localidad[]>('/locations/localidades').then(setLocalidades).catch(errors.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function entrar(user: Usuario, nombre: string | null) {
    setCreada(nombre);
    if (nextParam || carrito.cantidad > 0) {
      router.push(destinoAlIngresar(user, nextParam, carrito.cantidad > 0));
      router.refresh();
      return;
    }
    setSending(false);
    router.refresh();
  }

  function marcarPin(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    const lat = (-31.53 - (y / 100) * 0.02).toFixed(4);
    const lng = (-68.525 + (x / 100) * 0.02).toFixed(4);
    setPin({ x, y, texto: `Pin: Lat ${lat}, Lng ${lng}` });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const texto = (campo: string) => String(form.get(campo) ?? '').trim();
    errors.clear();
    if (form.get('password') !== form.get('repetir')) {
      errors.field('repetir', 'Las contraseñas no coinciden');
      return;
    }
    if (!/^\d{7,8}$/.test(dni)) {
      errors.field('dni', 'El DNI son 7 u 8 números, sin puntos');
      return;
    }
    if (!localidad) {
      errors.field('domicilio.localidad_id', 'Elegí el departamento');
      return;
    }
    const digitosTel = (telefonoNum || texto('telefono')).replace(/\D/g, '');
    if (!digitosTel) {
      errors.field('telefono', 'Ingresá tu teléfono');
      return;
    }
    if (digitosTel.length > DIGITOS_TELEFONO_AR) {
      errors.field('telefono', `Máximo ${DIGITOS_TELEFONO_AR} dígitos`);
      return;
    }
    if ((pais === '+54' || pais.includes('+54')) && digitosTel.length !== DIGITOS_TELEFONO_AR) {
      errors.field(
        'telefono',
        `En Argentina el número tiene ${DIGITOS_TELEFONO_AR} dígitos (área + número, sin 0 ni 15)`
      );
      return;
    }
    const telefono = armarTelefonoPerfil(pais, tipoTel, digitosTel);
    if (!telefono) {
      errors.field('telefono', 'Ingresá tu teléfono');
      return;
    }
    const barrio = texto('barrio');
    const refs = texto('referencias');
    const referencias = [barrio ? `Barrio: ${barrio}` : '', refs].filter(Boolean).join(' · ') || undefined;

    setSending(true);
    try {
      const user = await register({
        email: texto('email'),
        password: String(form.get('password')),
        nombre: texto('nombre'),
        apellido: texto('apellido'),
        telefono,
        dni,
        domicilio: {
          calle: texto('calle'),
          numero: texto('numero'),
          ...(texto('piso_depto') && { piso_depto: texto('piso_depto') }),
          ...(referencias && { referencias }),
          localidad_id: localidad,
        },
        aceptaTerminos: form.get('aceptaTerminos') === 'on',
      });
      entrar(user, texto('nombre'));
    } catch (error) {
      errors.set(error);
      setSending(false);
    }
  }

  const f = errors.fields;
  const depts = (
    localidades.some((l) => /san juan/i.test(l.provincia))
      ? localidades.filter((l) => /san juan/i.test(l.provincia))
      : localidades
  )
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return (
    <div className="centered-screen signup-screen">
      <div className="simple-header">
        <Link href="/" className="official-logo" aria-label={`${BRAND_NAME}, ir al inicio`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logos/Negativo_logo_h_w.svg" width={250} height={31} alt="" />
        </Link>
        <span>
          ¿Ya tenés una cuenta?{' '}
          <Link href={nextParam ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Iniciar sesión</Link>
        </span>
      </div>
      <main className="signup-shell">
        {creada !== undefined ? (
          <div className="signup-exito">
            <AvisoDisenio tipo="success" titulo="¡Usuario creado con éxito!">
              {creada ? `Bienvenido/a, ${creada}. ` : ''}Tu cuenta quedó lista como comprador.
            </AvisoDisenio>
            <div className="stack-actions">
              <Link href="/" className="ds-btn primary">
                Explorar marketplace <Icon name="arrow-right" size={17} />
              </Link>
              <Link href="/vendor/nueva-tienda" className="ds-btn secondary">
                Convertirme en Comercio
              </Link>
            </div>
            <p className="signup-exito-nota">
              También podés sumar tu comercio más adelante desde Mi cuenta o el menú de usuario.
            </p>
          </div>
        ) : (
          <>
            {errors.message && <AvisoDisenio titulo="No pudimos crear tu cuenta">{errors.message}</AvisoDisenio>}

            <div className="form-heading centered">
              <span>SUMATE A {PRODUCT_NAME.toUpperCase()}</span>
              <h2>Creá tu cuenta de cliente</h2>
              <p>Es rápido y gratis. Necesitamos tus datos y dirección exacta para coordinar los envíos en San Juan.</p>
            </div>

            <form onSubmit={onSubmit} noValidate className="signup-form">
              <div className="split-fields">
                <CampoDisenio
                  label="Nombre"
                  name="nombre"
                  placeholder="Ej. Martina"
                  autoComplete="given-name"
                  required
                  error={f.nombre}
                />
                <CampoDisenio
                  label="Apellido"
                  name="apellido"
                  placeholder="Ej. López"
                  autoComplete="family-name"
                  required
                  error={f.apellido}
                />
              </div>

              <div className="split-fields">
                <CampoDisenio
                  label="DNI (7 u 8 números, sin puntos)"
                  name="dni"
                  placeholder="Ej. 38123456"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  required
                  value={dni}
                  error={f.dni}
                  onChange={(e) => {
                    setDni(e.target.value.replace(/\D/g, '').slice(0, 8));
                    errors.dismiss('dni');
                  }}
                />
                <CampoDisenio
                  label="Correo electrónico"
                  name="email"
                  type="email"
                  placeholder="nombre@correo.com"
                  autoComplete="email"
                  defaultValue={params.get('email') ?? undefined}
                  required
                  error={f.email}
                />
              </div>

              <fieldset className="ds-caja signup-caja">
                <div className="ds-caja-cabecera">
                  <legend>
                    <Icon name="phone" size={16} /> Teléfono de contacto / WhatsApp
                  </legend>
                </div>
                <div className="signup-tel-grid">
                  <label className="ds-field">
                    <span>País (característica)</span>
                    <select value={pais} onChange={(e) => setPais(e.target.value)} aria-label="País del teléfono">
                      {PAISES.map((p) => (
                        <option key={p.codigo} value={p.codigo}>
                          {p.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ds-field">
                    <span>Tipo</span>
                    <select
                      value={tipoTel}
                      onChange={(e) => setTipoTel(e.target.value as TipoTelefono)}
                      aria-label="Tipo de teléfono"
                    >
                      {Object.entries(TIPOS_TELEFONO).map(([valor, etiqueta]) => (
                        <option key={valor} value={valor}>
                          {etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={`ds-field${f.telefono ? ' error' : ''}`}>
                    <span>Número (solo números)</span>
                    <div className="telefono-numero signup-tel-numero">
                      <span className="telefono-prefijo" aria-hidden="true">
                        {prefijoTel}
                      </span>
                      <input
                        type="tel"
                        name="telefono"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="Ej. 2645123456"
                        maxLength={DIGITOS_TELEFONO_AR}
                        value={telefonoNum}
                        required
                        aria-invalid={!!f.telefono}
                        aria-label={`Número de teléfono con prefijo ${prefijoTel}`}
                        onChange={(e) => {
                          setTelefonoNum(soloDigitosTelefono(e.target.value));
                          errors.dismiss('telefono');
                        }}
                      />
                    </div>
                    {f.telefono && <small role="alert">{f.telefono}</small>}
                  </label>
                </div>
                <small className="ds-ayuda">
                  Máximo {DIGITOS_TELEFONO_AR} dígitos. En Argentina: fijo +54, celular/WhatsApp +549. Sin el 0 ni el
                  15. Ej.: 2645123456
                </small>
              </fieldset>

              <fieldset className="ds-caja signup-caja">
                <div className="ds-caja-cabecera">
                  <legend>
                    <Icon name="pin" size={16} /> Domicilio de entrega (para el repartidor)
                  </legend>
                </div>

                <div className="signup-dom-calle">
                  <CampoDisenio
                    label="Calle / avenida"
                    name="calle"
                    placeholder="Ej. Av. Libertador Gral. San Martín"
                    autoComplete="address-line1"
                    maxLength={120}
                    required
                    error={f['domicilio.calle'] ?? f.domicilio}
                  />
                  <CampoDisenio
                    label="Altura / N°"
                    name="numero"
                    placeholder="Ej. 1200"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    error={f['domicilio.numero']}
                  />
                </div>

                <div className="split-fields">
                  <CampoDisenio
                    label="Barrio / villa / loteo"
                    name="barrio"
                    placeholder="Ej. B° Copacabana"
                    maxLength={80}
                  />
                  <CampoDisenio
                    label="Casa / manzana / depto"
                    name="piso_depto"
                    placeholder="Ej. Casa 3, Manzana B"
                    maxLength={40}
                    error={f['domicilio.piso_depto']}
                  />
                </div>

                <SelectorDisenio
                  label="Departamento (San Juan)"
                  name="localidad_id"
                  value={localidad}
                  onChange={(v) => {
                    setLocalidad(v);
                    errors.dismiss('domicilio.localidad_id');
                  }}
                  placeholder={depts.length ? 'Seleccioná el departamento' : 'Cargando…'}
                  opciones={depts.map((l) => ({ value: l.id, label: l.nombre }))}
                  error={f['domicilio.localidad_id']}
                />

                <CampoDisenio
                  label="Referencias adicionales para el cadete"
                  name="referencias"
                  placeholder="Ej. Portón negro, timbre rojo, entre calles Gral. Acha y Tucumán"
                  maxLength={200}
                  error={f['domicilio.referencias']}
                />

                <div>
                  <label className="ds-field">
                    <span>Ubicación exacta en el mapa (San Juan)</span>
                  </label>
                  <div
                    className="signup-mapa"
                    role="button"
                    tabIndex={0}
                    title="Hacé clic para marcar tu ubicación"
                    onClick={marcarPin}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setPin(PIN_CENTRO);
                      }
                    }}
                  >
                    <div className="signup-mapa-guia">
                      Mapa interactivo San Juan
                      <span>Hacé clic para posicionar el marcador de entrega</span>
                    </div>
                    <span className="signup-mapa-pin" style={{ left: `${pin.x}%`, top: `${pin.y}%` }} aria-hidden>
                      <Icon name="pin" size={26} />
                    </span>
                  </div>
                  <div className="signup-mapa-pie">
                    <span>{pin.texto}</span>
                    <button type="button" onClick={() => setPin(PIN_CENTRO)}>
                      Centrar pin
                    </button>
                  </div>
                </div>
              </fieldset>

              <div className="split-fields">
                <CampoDisenio
                  label="Contraseña"
                  name="password"
                  type="password"
                  icono="lock"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  required
                  error={f.password}
                />
                <CampoDisenio
                  label="Repetir contraseña"
                  name="repetir"
                  type="password"
                  icono="lock"
                  placeholder="Repetirla"
                  autoComplete="new-password"
                  required
                  error={f.repetir}
                />
              </div>

              <CasillaDisenio
                name="aceptaTerminos"
                className="terms"
                error={f.aceptaTerminos}
                onChange={() => errors.dismiss('aceptaTerminos')}
              >
                Acepto los{' '}
                <Link href="/terminos" target="_blank">
                  Términos y Condiciones
                </Link>{' '}
                y la{' '}
                <Link href="/privacidad" target="_blank">
                  Política de Privacidad
                </Link>
                .
              </CasillaDisenio>

              <button className="ds-btn primary" type="submit" disabled={sending}>
                {sending ? (
                  <>
                    <span className="spinner" /> Creando cuenta…
                  </>
                ) : (
                  <>
                    Crear cuenta y continuar <Icon name="arrow-right" size={17} />
                  </>
                )}
              </button>
            </form>

            <div className="account-note">
              <Icon name="info" size={17} />
              <p>Tu cuenta se crea primero como comprador. Cuando quieras, podés sumar tu comercio sin crear otra cuenta.</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function wakeRegistro() {
  void fetch('/api/health', { credentials: 'same-origin', cache: 'no-store' }).catch(() => undefined);
}
