import Link from 'next/link';
import type { ReactNode } from 'react';
import { FECHA_TERMINOS, TITULAR } from '@/lib/legal';
import { Icon } from '@/components/ui/icon';

export interface SeccionLegal {
  id: string;
  titulo: string;
  contenido: ReactNode;
}

/** Términos, privacidad: índice a la izquierda y el texto por secciones. */
export function DocumentoLegal({
  antetitulo,
  titulo,
  intro,
  secciones,
  otro,
}: {
  antetitulo: string;
  titulo: string;
  intro: ReactNode;
  secciones: SeccionLegal[];
  otro: { href: string; texto: string };
}) {
  const datos = [TITULAR.razonSocial, TITULAR.cuit && `CUIT ${TITULAR.cuit}`, TITULAR.domicilio].filter(Boolean);
  return (
    <div className="legal">
      <header className="legal-cabecera">
        <span>{antetitulo}</span>
        <h1>{titulo}</h1>
        <p>Vigente desde el {FECHA_TERMINOS}.</p>
      </header>
      <div className="legal-cuerpo">
        <nav className="legal-indice" aria-label="Contenido">
          <strong>Contenido</strong>
          <ol>
            {secciones.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.titulo}</a>
              </li>
            ))}
          </ol>
          <Link href={otro.href} className="legal-otro">
            <Icon name="book" size={15} /> {otro.texto}
          </Link>
        </nav>
        <article className="legal-texto">
          <div className="legal-intro">{intro}</div>
          {secciones.map((s, i) => (
            <section key={s.id} id={s.id}>
              <h2>
                {i + 1}. {s.titulo}
              </h2>
              {s.contenido}
            </section>
          ))}
          <footer className="legal-pie">
            <p>
              <strong>{TITULAR.nombre}</strong>
              {datos.length > 0 && ` · ${datos.join(' · ')}`}
              {TITULAR.correo && (
                <>
                  {' · '}
                  <a href={`mailto:${TITULAR.correo}`}>{TITULAR.correo}</a>
                </>
              )}
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
