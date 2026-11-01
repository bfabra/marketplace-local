'use client';

import type { TelefonoTienda, TipoTelefono } from '@/lib/api-client';
import { MAX_TELEFONOS, PAISES, TIPOS_TELEFONO, telefonoVacio } from '@/lib/telefonos';
import { Icon } from '@/components/ui/icon';

/** Teléfonos de contacto de la tienda (docs/diseno, alta de comercio): país, número y tipo. */
export function TelefonosTienda({
  valor,
  onChange,
  errores,
}: {
  valor: TelefonoTienda[];
  onChange: (lista: TelefonoTienda[]) => void;
  /** Errores con la ruta del API: "telefonos", "telefonos.0.numero"… */
  errores: Record<string, string>;
}) {
  const lista = valor.length ? valor : [telefonoVacio()];
  const cambiar = (i: number, cambios: Partial<TelefonoTienda>) =>
    onChange(lista.map((t, j) => (j === i ? { ...t, ...cambios } : t)));

  return (
    <fieldset className="ds-caja telefonos-tienda">
      <div className="ds-caja-cabecera">
        <legend>
          <Icon name="phone" size={16} /> Teléfonos de contacto
        </legend>
        {lista.length < MAX_TELEFONOS && (
          <button type="button" className="ds-btn secondary ds-btn-chico" onClick={() => onChange([...lista, telefonoVacio('celular')])}>
            <Icon name="plus" size={14} /> Agregar otro teléfono
          </button>
        )}
      </div>
      <ul>
        {lista.map((t, i) => {
          const error = errores[`telefonos.${i}.numero`] ?? errores[`telefonos.${i}.pais`] ?? errores[`telefonos.${i}.tipo`];
          return (
            <li key={i} className={error ? 'error' : undefined}>
              <div className="telefono-fila">
                <select
                  aria-label={`Característica del país del teléfono ${i + 1}`}
                  value={t.pais}
                  onChange={(e) => cambiar(i, { pais: e.target.value })}
                >
                  {PAISES.some((p) => p.codigo === t.pais) ? null : <option value={t.pais}>{t.pais}</option>}
                  {PAISES.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.etiqueta}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="tel"
                  aria-label={`Número del teléfono ${i + 1}`}
                  aria-invalid={!!error}
                  placeholder="Ej. 264 4123456"
                  maxLength={20}
                  value={t.numero}
                  onChange={(e) => cambiar(i, { numero: e.target.value })}
                />
                <select
                  aria-label={`Tipo del teléfono ${i + 1}`}
                  value={t.tipo}
                  onChange={(e) => cambiar(i, { tipo: e.target.value as TipoTelefono })}
                >
                  {Object.entries(TIPOS_TELEFONO).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
                {lista.length > 1 ? (
                  <button
                    type="button"
                    className="telefono-quitar"
                    aria-label={`Quitar el teléfono ${i + 1}`}
                    title="Quitar"
                    onClick={() => onChange(lista.filter((_, j) => j !== i))}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                ) : (
                  <span className="telefono-quitar" aria-hidden="true" />
                )}
              </div>
              {error && <small role="alert">{error}</small>}
            </li>
          );
        })}
      </ul>
      {errores.telefonos ? (
        <small role="alert">{errores.telefonos}</small>
      ) : (
        <small className="ds-ayuda">
          Podés cargar hasta {MAX_TELEFONOS} números para WhatsApp, llamadas o líneas fijas. El primero es el principal.
        </small>
      )}
    </fieldset>
  );
}
