'use client';

import type { TelefonoTienda, TipoTelefono } from '@/lib/api-client';
import { MAX_TELEFONOS, PAISES, TIPOS_TELEFONO, prefijoTelefono, telefonoVacio } from '@/lib/telefonos';
import { Icon } from '@/components/ui/icon';

/** Teléfonos de contacto de la tienda (docs/diseno #merchant): país, tipo, nº con prefijo. */
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
          <Icon name="phone" size={16} /> Teléfonos de contacto (máx. {MAX_TELEFONOS})
        </legend>
        {lista.length < MAX_TELEFONOS ? (
          <button type="button" className="ds-btn secondary ds-btn-chico" onClick={() => onChange([...lista, telefonoVacio('celular')])}>
            + Agregar otro teléfono
          </button>
        ) : (
          <span className="telefonos-limite">Límite de {MAX_TELEFONOS} teléfonos alcanzado</span>
        )}
      </div>
      <ul>
        {lista.map((t, i) => {
          const error = errores[`telefonos.${i}.numero`] ?? errores[`telefonos.${i}.pais`] ?? errores[`telefonos.${i}.tipo`];
          const prefijo = prefijoTelefono(t.pais, t.tipo);
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
                <div className="telefono-numero">
                  <span className="telefono-prefijo" aria-hidden="true">
                    {prefijo}
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    aria-label={`Número del teléfono ${i + 1}`}
                    aria-invalid={!!error}
                    placeholder="Ej. 2644123456"
                    maxLength={10}
                    value={t.numero}
                    onChange={(e) => cambiar(i, { numero: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  />
                </div>
                {lista.length > 1 ? (
                  <button
                    type="button"
                    className="telefono-quitar"
                    aria-label={`Quitar el teléfono ${i + 1}`}
                    title="Quitar"
                    onClick={() => onChange(lista.filter((_, j) => j !== i))}
                  >
                    Quitar
                  </button>
                ) : (
                  <span className="telefono-quitar telefono-quitar--hueco" aria-hidden="true" />
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
          Ingresá solo el código de área y número sin el 0 ni el 15. Podés registrar hasta {MAX_TELEFONOS} teléfonos.
        </small>
      )}
    </fieldset>
  );
}
