'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCategorias } from '@/hooks/use-categorias';
import { useClickOutside } from '@/hooks/use-click-outside';
import { enlaceCategoria, hijasPorPadre } from '@/lib/catalogo';
import { raizDeRuta, visualCategoria } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';

// El resto de las principales queda en «Ver todas las categorías».
const RAICES_EN_MENU = 12;

const esEscritorio = () => window.matchMedia('(min-width: 1024px)').matches;

/**
 * «Categorías ▾» de la cabecera. En la computadora despliega las principales
 * y, al pasar por cada una, sus subcategorías; en el celular lleva directo a
 * la página con todas.
 */
export function MenuCategorias({ className = '' }: { className?: string }) {
  const categorias = useCategorias();
  const router = useRouter();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState<string | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout>>();
  const porHover = useRef(false);
  const id = useId();

  const hijas = useMemo(() => hijasPorPadre(categorias ?? []), [categorias]);
  const raices = hijas.get('') ?? [];
  const actual = raices.find((r) => r.id === activa) ?? raices[0];
  const subcategorias = actual ? (hijas.get(actual.id) ?? []) : [];

  const cerrar = useCallback(() => {
    clearTimeout(espera.current);
    setAbierto(false);
  }, []);
  useClickOutside(contenedor, abierto, cerrar);
  useEffect(cerrar, [pathname, cerrar]);
  useEffect(() => () => clearTimeout(espera.current), []);

  function demorar(accion: () => void, ms: number) {
    clearTimeout(espera.current);
    espera.current = setTimeout(accion, ms);
  }

  function alPasar(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse' || !esEscritorio()) return;
    if (abierto) {
      clearTimeout(espera.current);
      return;
    }
    demorar(() => {
      porHover.current = true;
      setAbierto(true);
    }, 120);
  }

  // Abierto con un clic, queda fijo hasta otro clic, Escape o un clic afuera.
  function alSalir(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse' || !esEscritorio()) return;
    if (!abierto || porHover.current) demorar(() => setAbierto(false), 250);
  }

  function alTocar() {
    if (!esEscritorio()) {
      router.push('/categorias');
      return;
    }
    clearTimeout(espera.current);
    if (abierto && porHover.current) {
      porHover.current = false;
    } else {
      porHover.current = false;
      setAbierto((a) => !a);
    }
  }

  return (
    <div ref={contenedor} className={`menu-cat ${className}`} onPointerEnter={alPasar} onPointerLeave={alSalir}>
      <button
        type="button"
        className="header-nav-link menu-cat-boton"
        aria-expanded={abierto}
        aria-controls={`${id}-panel`}
        aria-current={pathname === '/categorias' ? 'page' : undefined}
        onClick={alTocar}
      >
        Categorías
        <Icon name="chevron-down" size={14} className="menu-cat-flecha" />
      </button>

      {abierto && (
        <div
          id={`${id}-panel`}
          className="popover menu-cat-panel"
          onClick={(e) => (e.target as HTMLElement).closest('a') && cerrar()}
        >
          {!categorias ? (
            <p className="muted menu-cat-cargando">Cargando categorías…</p>
          ) : raices.length === 0 ? (
            <p className="muted menu-cat-cargando">No pudimos cargar las categorías.</p>
          ) : (
            <>
              <ul className="menu-cat-raices">
                {raices.slice(0, RAICES_EN_MENU).map((r) => {
                  const { icono, tono } = visualCategoria(raizDeRuta(r.ruta));
                  return (
                    <li key={r.id}>
                      <Link
                        href={enlaceCategoria(r.id)}
                        className={r.id === actual?.id ? 'activa' : undefined}
                        onPointerEnter={() => setActiva(r.id)}
                        onFocus={() => setActiva(r.id)}
                      >
                        <span className="menu-cat-icono" style={{ background: tono.bg, color: tono.fg }}>
                          <Icon name={icono} size={15} />
                        </span>
                        <span className="menu-cat-nombre">{r.nombre}</span>
                        <Icon name="chevron-right" size={14} className="menu-cat-chevron" />
                      </Link>
                    </li>
                  );
                })}
                <li className="menu-cat-todas">
                  <Link href="/categorias">
                    <Icon name="grid" size={16} />
                    Ver todas las categorías
                    <Icon name="arrow-right" size={14} />
                  </Link>
                </li>
              </ul>

              {actual && (
                <div className="menu-cat-detalle">
                  <div className="menu-cat-detalle-cabecera">
                    <strong>{actual.nombre}</strong>
                    <Link href={enlaceCategoria(actual.id)}>
                      Ver todo
                      <Icon name="arrow-right" size={14} />
                    </Link>
                  </div>
                  <ul className="menu-cat-subs">
                    {subcategorias.map((s) => (
                      <li key={s.id}>
                        <Link href={enlaceCategoria(s.id)}>
                          {s.nombre}
                          {s.productos > 0 && <small>{s.productos}</small>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
