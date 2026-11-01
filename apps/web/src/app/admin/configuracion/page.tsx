'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError, api, type ParametroConfig } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { plural } from '@/lib/visual';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Icon, type IconName } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EncabezadoAdmin } from '@/components/admin/encabezado';

const ICONO_GRUPO: Record<string, IconName> = {
  Compras: 'cart',
  Suscripciones: 'card',
  Tiendas: 'store',
  Moderación: 'shield',
};

const anclaDe = (grupo: string) =>
  `grupo-${grupo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`;

function Parametro({
  p,
  onGuardado,
}: {
  p: ParametroConfig;
  onGuardado: (lista: ParametroConfig[], p: ParametroConfig) => void;
}) {
  const original = typeof p.valor === 'boolean' ? p.valor : String(p.valor);
  const [valor, setValor] = useState<string | boolean>(original);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cambiado = valor !== original;
  const rango =
    p.minimo !== null && p.maximo !== null ? `Entre ${p.minimo} y ${p.maximo}` : p.minimo !== null ? `Mínimo ${p.minimo}` : null;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const enviar = typeof valor === 'boolean' ? valor : Number(valor);
    if (typeof enviar === 'number' && (valor === '' || !Number.isInteger(enviar))) {
      setError('Ingresá un número entero');
      return;
    }
    setGuardando(true);
    try {
      const lista = await api<ParametroConfig[]>(`/admin/configuracion/${p.clave}`, { method: 'PUT', body: { valor: enviar } });
      onGuardado(lista, p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setGuardando(false);
    }
  }

  const id = `param-${p.clave}`;
  return (
    <form className={cambiado ? 'parametro parametro-cambiado' : 'parametro'} onSubmit={guardar} noValidate>
      <div className="parametro-texto">
        <div className="parametro-titulo">
          {typeof valor === 'boolean' ? (
            <strong id={`${id}-etiqueta`}>{p.etiqueta}</strong>
          ) : (
            <label htmlFor={id}>
              <strong>{p.etiqueta}</strong>
            </label>
          )}
          {cambiado && <span className="tag parametro-sin-guardar">Sin guardar</span>}
        </div>
        {p.descripcion && <span className="muted">{p.descripcion}</span>}
        <small className="parametro-meta">
          <Icon name="clock" size={13} />
          Último cambio: {formatDate(p.actualizado_en)}
          {p.actualizadoPor ? ` · ${p.actualizadoPor}` : ''}
        </small>
      </div>
      <div className="parametro-control">
        {typeof valor === 'boolean' ? (
          <button
            type="button"
            role="switch"
            aria-checked={valor}
            aria-labelledby={`${id}-etiqueta`}
            className="interruptor"
            onClick={() => setValor(!valor)}
          >
            <span className="interruptor-pista" aria-hidden="true">
              <span className="interruptor-perilla" />
            </span>
            <span className="interruptor-texto">{valor ? 'Activado' : 'Desactivado'}</span>
          </button>
        ) : (
          <div className="field">
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={p.minimo ?? undefined}
              max={p.maximo ?? undefined}
              step={1}
              value={valor}
              aria-invalid={!!error}
              aria-describedby={rango ? `${id}-rango` : undefined}
              onChange={(e) => setValor(e.target.value)}
            />
            {rango && (
              <small id={`${id}-rango`} className="field-hint">
                {rango}
              </small>
            )}
          </div>
        )}
        {cambiado && (
          <div className="parametro-botones">
            <button className="btn" type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={guardando}
              onClick={() => {
                setValor(original);
                setError(null);
              }}
            >
              Deshacer
            </button>
          </div>
        )}
        {error && <small className="field-error parametro-error">{error}</small>}
      </div>
    </form>
  );
}

export default function AdminSettingsPage() {
  const toast = useToast();
  const [parametros, setParametros] = useState<ParametroConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ParametroConfig[]>('/admin/configuracion')
      .then(setParametros)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, []);

  const grupos = useMemo(() => {
    const mapa = new Map<string, ParametroConfig[]>();
    for (const p of parametros ?? []) mapa.set(p.grupo, [...(mapa.get(p.grupo) ?? []), p]);
    return [...mapa.entries()];
  }, [parametros]);

  if (error) return <Alert>{error}</Alert>;
  if (!parametros) return <PageSkeleton />;

  return (
    <div className="stack">
      <EncabezadoAdmin
        titulo="Configuración general"
        descripcion="Reglas que usa toda la plataforma. Cada cambio se aplica al instante y queda registrado en Actividad."
      />

      {grupos.length > 1 && (
        <nav className="config-indice" aria-label="Grupos de configuración">
          {grupos.map(([grupo, lista]) => (
            <a key={grupo} href={`#${anclaDe(grupo)}`} className="config-indice-item">
              <Icon name={ICONO_GRUPO[grupo] ?? 'sliders'} size={16} />
              {grupo}
              <span className="tab-cuenta">{lista.length}</span>
            </a>
          ))}
        </nav>
      )}

      {grupos.map(([grupo, lista]) => (
        <section key={grupo} id={anclaDe(grupo)} className="card stack config-grupo">
          <div className="tarjeta-cabecera">
            <span className="icono-suave" aria-hidden="true">
              <Icon name={ICONO_GRUPO[grupo] ?? 'sliders'} size={20} />
            </span>
            <div>
              <h2>{grupo}</h2>
              <p>{plural(lista.length, 'parámetro', 'parámetros')}</p>
            </div>
          </div>
          <div className="parametros">
            {lista.map((p) => (
              <Parametro
                key={`${p.clave}:${p.actualizado_en}`}
                p={p}
                onGuardado={(nueva, guardado) => {
                  setParametros(nueva);
                  toast({ titulo: 'Cambio guardado', texto: guardado.etiqueta });
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
