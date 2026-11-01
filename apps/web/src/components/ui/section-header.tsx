import Link from 'next/link';
import { Icon } from './icon';

export function SectionHeader({
  titulo,
  subtitulo,
  accion,
  id,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: { href: string; label: string };
  id?: string;
}) {
  return (
    <div className="section-header">
      <div>
        <h2 id={id}>{titulo}</h2>
        {subtitulo && <p className="muted">{subtitulo}</p>}
      </div>
      {accion && (
        <Link href={accion.href} className="link-arrow">
          {accion.label}
          <Icon name="arrow-right" size={16} />
        </Link>
      )}
    </div>
  );
}
