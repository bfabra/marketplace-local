import Link from 'next/link';

export const BRAND_NAME = 'Tu Comercio Local';

// Archivos oficiales del diseñador: se usan tal cual, sin redibujar ni recolorear.
const LOGOS = '/brand/logos';
const PROPORCION_ICONO = 665.36 / 718.64;
const PROPORCION_COMPLETO = 978.33 / 1049.22;
const PROPORCION_HORIZONTAL = 665.36 / 5348.23;

export function LogoMark({ size = 36, claro = false }: { size?: number; claro?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="logo-icono"
      src={`${LOGOS}/${claro ? 'Negativo_iso_w' : 'Logo'}.svg`}
      width={size}
      height={Math.round(size * PROPORCION_ICONO)}
      alt=""
      aria-hidden="true"
    />
  );
}

/** Ícono con el nombre debajo. `claro` es la versión blanca para fondos azules. */
export function LogoCompleto({ ancho = 140, claro = false }: { ancho?: number; claro?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="logo-completo"
      src={`${LOGOS}/${claro ? 'Negativo_logo_w' : 'Logo_nombre'}.svg`}
      width={ancho}
      height={Math.round(ancho * PROPORCION_COMPLETO)}
      alt={BRAND_NAME}
    />
  );
}

export function Logo() {
  return (
    <Link href="/" className="brand market-logo" aria-label={`${BRAND_NAME}, ir al inicio`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="brand-logo"
        src={`${LOGOS}/Logo_h.svg`}
        width={210}
        height={Math.round(210 * PROPORCION_HORIZONTAL)}
        alt=""
        aria-hidden="true"
      />
    </Link>
  );
}
