'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { ModalPortal } from '@/components/vendor/modal-portal';

/**
 * Modal de publicación al estilo #merchant-panel (merchant.js → add-product-modal):
 * elige carga masiva Excel o producto individual; navega a las rutas reales.
 */
export function ModalPublicar({
  tiendaId,
  tiendaNombre,
  abierto,
  onCerrar,
}: {
  tiendaId: string;
  tiendaNombre: string;
  abierto: boolean;
  onCerrar: () => void;
}) {
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const base = `/vendor/tiendas/${tiendaId}/productos`;

  return (
    <ModalPortal>
      <div className="mp-modal-overlay" role="presentation" onClick={onCerrar}>
        <div
          className="mp-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mp-modal-publicar-titulo"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="mp-modal-cabecera">
            <div>
              <h3 id="mp-modal-publicar-titulo">Publicar producto o carga masiva</h3>
              <span>
                Sucursal: <strong>{tiendaNombre}</strong>
              </span>
            </div>
            <button type="button" className="mp-modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
              <Icon name="x" size={22} />
            </button>
          </header>

          <div className="mp-modal-cuerpo">
            <div className="mp-modal-excel">
              <div>
                <h4>Carga masiva automática (Excel / CSV)</h4>
                <p>Subí el archivo de inventario de tu comercio para importar todos tus productos juntos.</p>
              </div>
              <Link href={`${base}/lote`} className="mp-modal-excel-btn" onClick={onCerrar}>
                Seleccionar archivo Excel (.xlsx / .csv)
              </Link>
            </div>

            <div className="mp-modal-o">
              <hr />
              <span>O cargar producto individual</span>
              <hr />
            </div>

            <div className="mp-modal-individual">
              <p>
                Completá nombre, categoría, atributos dinámicos de la ficha, variantes, stock y fotos (hasta 8) en el
                formulario completo.
              </p>
              <Link href={`${base}/nuevo`} className="mp-btn-crear" onClick={onCerrar}>
                + Publicar un producto
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
