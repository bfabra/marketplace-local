'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, type Localidad, type Usuario } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { safeNext } from '@/lib/redirect';
import { destinoAlIngresar } from '@/lib/equipo';
import { Icon } from '@/components/ui/icon';
import { BRAND_NAME } from '@/components/layout/logo';
import { useFormErrors } from './use-form-errors';
import { AvisoDisenio, CampoDisenio, CasillaDisenio, SelectorDisenio } from './campo-disenio';
import { AccesoGoogle } from './acceso-google';

/** Crear cuenta: copia de la maqueta del diseñador (docs/diseno, #signup). */
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

  useEffect(() => {
    api<Localidad[]>('/locations/localidades').then(setLocalidades).catch(errors.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function entrar(user: Usuario, nombre: string | null) {
    setCreada(nombre);
    // Si hay destino pendiente o carrito, seguimos el flujo de compra.
    // Si no, mostramos la bienvenida con opción de volverse comercio (AGENTS §3.5).
    if (nextParam || carrito.cantidad > 0) {
      router.push(destinoAlIngresar(user, nextParam, carrito.cantidad > 0));
      router.refresh();
      return;
    }
    setSending(false);
    router.refresh();
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
    setSending(true);
    try {
      const user = await register({
        email: texto('email'),
        password: String(form.get('password')),
        nombre: texto('nombre'),
        apellido: texto('apellido'),
        ...(texto('telefono') && { telefono: texto('telefono') }),
        dni: texto('dni'),
        domicilio: {
          calle: texto('calle'),
          numero: texto('numero'),
          ...(texto('piso_depto') && { piso_depto: texto('piso_depto') }),
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

  return (
    <div className="centered-screen">
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
          <span>SUMATE A {BRAND_NAME.toUpperCase()}</span>
          <h2>Creá tu cuenta de cliente</h2>
          <p>Registrate gratis y recibí envíos en San Juan desde comercios locales.</p>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="form-grid">
            <CampoDisenio label="Nombre" name="nombre" icono="user" placeholder="Ej. Martina" autoComplete="given-name" required error={f.nombre} />
            <CampoDisenio label="Apellido" name="apellido" icono="user" placeholder="Ej. López" autoComplete="family-name" required error={f.apellido} />
            <CampoDisenio
              label="DNI"
              name="dni"
              icono="id"
              placeholder="Ej. 38123456"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              required
              error={f.dni}
            />
            <CampoDisenio
              label="Teléfono (opcional)"
              name="telefono"
              type="tel"
              icono="phone"
              placeholder="Ej. 264 4123456"
              autoComplete="tel"
              error={f.telefono}
            />
            <CampoDisenio
              label="Correo electrónico"
              name="email"
              type="email"
              icono="mail"
              placeholder="nombre@correo.com"
              autoComplete="email"
              defaultValue={params.get('email') ?? undefined}
              required
              error={f.email}
              className="full"
            />

            <p className="form-grid-titulo">
              <Icon name="pin" size={16} /> Domicilio de entrega en San Juan
            </p>
            <CampoDisenio
              label="Calle / avenida"
              name="calle"
              icono="pin"
              placeholder="Ej. Av. Libertador Gral. San Martín"
              autoComplete="address-line1"
              maxLength={120}
              required
              error={f['domicilio.calle'] ?? f.domicilio}
            />
            <div className="split-fields">
              <CampoDisenio label="Altura / número" name="numero" placeholder="1200" inputMode="numeric" maxLength={10} required error={f['domicilio.numero']} />
              <CampoDisenio label="Casa / manzana / depto" name="piso_depto" placeholder="Opcional" maxLength={30} error={f['domicilio.piso_depto']} />
            </div>
            <SelectorDisenio
              label="Departamento (San Juan)"
              name="localidad_id"
              value={localidad}
              onChange={(v) => {
                setLocalidad(v);
                errors.dismiss('domicilio.localidad_id');
              }}
              placeholder={localidades.length ? 'Seleccioná el departamento' : 'Cargando…'}
              opciones={(localidades.some((l) => /san juan/i.test(l.provincia))
                ? localidades.filter((l) => /san juan/i.test(l.provincia))
                : localidades
              ).map((l) => ({
                value: l.id,
                label: /san juan/i.test(l.provincia) ? l.nombre : `${l.nombre} (${l.provincia})`,
              }))}
              error={f['domicilio.localidad_id']}
              className="full"
            />

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
              placeholder="Ingresala nuevamente"
              autoComplete="new-password"
              required
              error={f.repetir}
            />
          </div>

          <CasillaDisenio name="aceptaTerminos" className="terms" error={f.aceptaTerminos} onChange={() => errors.dismiss('aceptaTerminos')}>
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
                Crear cuenta <Icon name="arrow-right" size={17} />
              </>
            )}
          </button>
        </form>

        <AccesoGoogle
          separador="o registrate con"
          registro
          onIngreso={(user, nueva) => {
            if (!nueva) {
              router.push(destinoAlIngresar(user, nextParam, carrito.cantidad > 0));
              router.refresh();
              return;
            }
            entrar(user, user.nombre);
          }}
          onError={errors.set}
        />

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
