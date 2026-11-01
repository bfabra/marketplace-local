'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Usuario } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { useDirectorio } from '@/hooks/use-directorio';
import { useOpciones } from '@/hooks/use-opciones';
import { safeNext } from '@/lib/redirect';
import { destinoAlIngresar } from '@/lib/equipo';
import { plural } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';
import { BRAND_NAME, LogoMark } from '@/components/layout/logo';
import { useFormErrors } from './use-form-errors';
import { AvisoDisenio, CampoDisenio, CasillaDisenio } from './campo-disenio';
import { AccesoGoogle } from './acceso-google';

/** Iniciar sesión: copia de la maqueta del diseñador (docs/diseno, #login). */
export function LoginForm() {
  const { login } = useAuth();
  const { carrito } = useCart();
  const { datos } = useDirectorio();
  const opciones = useOpciones();
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get('next');
  const next = safeNext(nextParam);
  const errors = useFormErrors();
  const [sending, setSending] = useState(false);
  const [listo, setListo] = useState(false);

  function ingresar(user: Usuario) {
    setListo(true);
    router.push(destinoAlIngresar(user, nextParam, carrito.cantidad > 0));
    router.refresh();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    errors.clear();
    setSending(true);
    try {
      ingresar(await login(String(form.get('email')), String(form.get('password')), form.get('recordarme') === 'on'));
    } catch (error) {
      errors.set(error);
      setSending(false);
    }
  }

  return (
    <div className="auth-screen">
      <section className="auth-visual">
        <div className="visual-overlay" />
        <div className="visual-top">
          <Link href="/" className="auth-brand" aria-label={`${BRAND_NAME}, ir al inicio`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logos/Negativo_logo_h_w.svg" width={250} height={31} alt="" />
          </Link>
        </div>
        <div className="visual-copy">
          <span className="local-pill">
            <i /> Hecho cerca tuyo
          </span>
          <h1>
            Todo lo que buscás,
            <br />
            <em>cerca tuyo.</em>
          </h1>
          <p>Descubrí comercios y productos de tu ciudad en un solo lugar.</p>
          <div className="visual-trust">
            <span>
              <Icon name="store" size={18} /> {datos ? plural(datos.tiendas.length, 'comercio', 'comercios') : 'Comercios locales'}
            </span>
            <span>
              <Icon name="users" size={18} /> Comunidad local
            </span>
          </div>
        </div>
      </section>

      <section className="auth-form-area">
        <Link href="/" className="mobile-logo" aria-label={`${BRAND_NAME}, ir al inicio`}>
          <LogoMark size={42} />
        </Link>
        <div className="form-shell">
          {listo && (
            <AvisoDisenio tipo="success" titulo="¡Inicio de sesión exitoso!">
              Te estamos llevando al marketplace.
            </AvisoDisenio>
          )}
          {params.has('restablecida') && !listo && !errors.message && (
            <AvisoDisenio tipo="success" titulo="Cambiaste tu contraseña">
              Ya podés ingresar con la nueva.
            </AvisoDisenio>
          )}
          {errors.message && <AvisoDisenio titulo="No pudimos iniciar sesión">{errors.message}</AvisoDisenio>}
          <div className="form-heading">
            <span>HOLA</span>
            <h2>Bienvenido</h2>
            <p>Iniciá sesión para continuar.</p>
          </div>
          <form onSubmit={onSubmit} noValidate>
            <CampoDisenio
              label="Correo electrónico"
              name="email"
              type="email"
              icono="mail"
              placeholder="nombre@correo.com"
              autoComplete="email"
              defaultValue={params.get('email') ?? undefined}
              required
              error={errors.fields.email}
            />
            <CampoDisenio
              label="Contraseña"
              name="password"
              type="password"
              icono="lock"
              placeholder="Ingresá tu contraseña"
              autoComplete="current-password"
              required
              error={errors.fields.password}
            />
            <div className="form-options">
              <CasillaDisenio name="recordarme">Recordarme</CasillaDisenio>
              {opciones?.recuperarClave && (
                <Link href="/recuperar" className="text-link">
                  ¿Olvidaste tu contraseña?
                </Link>
              )}
            </div>
            <button className="ds-btn primary" type="submit" disabled={sending}>
              {sending ? (
                <>
                  <span className="spinner" /> Ingresando…
                </>
              ) : (
                <>
                  Iniciar sesión <Icon name="arrow-right" size={17} />
                </>
              )}
            </button>
          </form>
          <AccesoGoogle separador="o continuar con" onIngreso={ingresar} onError={errors.set} />
          <p className="switch-copy">
            ¿Todavía no tenés una cuenta?{' '}
            <Link href={nextParam ? `/registro?next=${encodeURIComponent(next)}` : '/registro'}>Crear cuenta</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
