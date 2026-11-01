'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { useFavorites } from '@/hooks/use-favorites';
import { useToast } from '@/hooks/use-toast';
import { Icon } from './icon';

export function FavoriteButton({
  productoId,
  nombre,
  className = '',
  conTexto = false,
}: {
  productoId: string;
  nombre: string;
  className?: string;
  conTexto?: boolean;
}) {
  const { ids, alternar } = useFavorites();
  const toast = useToast();
  const [animar, setAnimar] = useState(false);
  const activo = ids.has(productoId);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const guardado = await alternar(productoId);
      setAnimar(guardado);
      toast(
        guardado
          ? { titulo: 'Guardado en favoritos', texto: nombre, accion: { href: '/favoritos', label: 'Ver' } }
          : { tipo: 'info', titulo: 'Quitado de favoritos', texto: nombre }
      );
    } catch (error) {
      toast({ tipo: 'error', titulo: 'No pudimos guardarlo', texto: error instanceof ApiError ? error.message : undefined });
    }
  }

  return (
    <button
      type="button"
      className={`fav-btn${activo ? ' is-active' : ''}${animar ? ' is-pop' : ''}${conTexto ? ' fav-btn-texto' : ''} ${className}`}
      aria-pressed={activo}
      aria-label={conTexto ? undefined : activo ? `Quitar ${nombre} de favoritos` : `Guardar ${nombre} en favoritos`}
      onClick={onClick}
      onAnimationEnd={() => setAnimar(false)}
    >
      <Icon name="heart" size={conTexto ? 20 : 18} filled={activo} />
      {conTexto && <span>{activo ? 'Guardado' : 'Guardar'}</span>}
    </button>
  );
}
