'use client';

import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '@/lib/api-client';
import { Icon } from '@/components/ui/icon';

export const numero = (n: number) => Number(n).toLocaleString('es-AR');

export function haceCuanto(iso: string) {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/**
 * Botón que, antes de ejecutar, pide un motivo para la tienda o el vendedor.
 * El motivo queda guardado y lo ve la otra parte.
 */
export function AccionConMotivo({
  label,
  pregunta,
  ayuda,
  confirmar,
  peligro = false,
  disabled = false,
  onConfirmar,
}: {
  label: string;
  pregunta: string;
  ayuda: string;
  confirmar: string;
  peligro?: boolean;
  disabled?: boolean;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const id = useId();
  const [abierta, setAbierta] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (motivo.trim().length < 5) {
      setError('Escribí al menos 5 caracteres.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(motivo.trim());
      setAbierta(false);
      setMotivo('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  if (!abierta) {
    return (
      <button className="btn btn-secondary" disabled={disabled} onClick={() => setAbierta(true)}>
        {label}
      </button>
    );
  }

  return (
    <form className="motivo-form" onSubmit={enviar} noValidate>
      <label className="field" htmlFor={id}>
        <span>{pregunta}</span>
        <textarea
          id={id}
          rows={3}
          maxLength={500}
          value={motivo}
          autoFocus
          aria-invalid={!!error}
          aria-describedby={`${id}-ayuda`}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <small id={`${id}-ayuda`} className="field-hint">
          {ayuda}
        </small>
        {error && <small className="field-error">{error}</small>}
      </label>
      <div className="actions">
        <button className={peligro ? 'btn btn-peligro' : 'btn'} disabled={enviando}>
          {enviando ? 'Guardando…' : confirmar}
        </button>
        <button type="button" className="btn btn-ghost" disabled={enviando} onClick={() => setAbierta(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Botón que pide confirmación ahí mismo antes de ejecutar. */
export function BotonConfirmar({
  label,
  pregunta,
  confirmar,
  peligro = false,
  disabled = false,
  className = 'btn btn-secondary',
  onConfirmar,
}: {
  label: ReactNode;
  pregunta: string;
  confirmar: string;
  peligro?: boolean;
  disabled?: boolean;
  className?: string;
  onConfirmar: () => Promise<void> | void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function confirmarAccion() {
    setEnviando(true);
    try {
      await onConfirmar();
    } finally {
      setEnviando(false);
      setAbierta(false);
    }
  }

  if (!abierta) {
    return (
      <button type="button" className={className} disabled={disabled} onClick={() => setAbierta(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirmar" role="group" aria-label={pregunta}>
      <span>{pregunta}</span>
      <button
        type="button"
        className={peligro ? 'btn btn-peligro' : 'btn'}
        disabled={enviando}
        autoFocus
        onClick={confirmarAccion}
      >
        {enviando ? 'Guardando…' : confirmar}
      </button>
      <button type="button" className="btn btn-ghost" disabled={enviando} onClick={() => setAbierta(false)}>
        Cancelar
      </button>
    </span>
  );
}

/** Campo para renombrar en el lugar. Si onGuardar falla, muestra el error del API. */
export function EditarTexto({
  valor,
  label,
  maxLength = 60,
  minLength = 2,
  onGuardar,
  onCancelar,
}: {
  valor: string;
  label: string;
  maxLength?: number;
  minLength?: number;
  onGuardar: (texto: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const id = useId();
  const [texto, setTexto] = useState(valor);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (limpio.length < minLength) {
      setError(minLength === 1 ? 'Escribí algo.' : `Escribí al menos ${minLength} caracteres.`);
      return;
    }
    if (limpio === valor) return onCancelar();
    setEnviando(true);
    setError(null);
    try {
      await onGuardar(limpio);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="editar-texto" onSubmit={enviar} noValidate>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        value={texto}
        maxLength={maxLength}
        autoFocus
        aria-invalid={!!error}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
      />
      <button className="btn" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
      <button type="button" className="btn btn-ghost" disabled={enviando} onClick={onCancelar}>
        Cancelar
      </button>
      {error && <small className="field-error">{error}</small>}
    </form>
  );
}

/** Buscador que espera a que se deje de escribir antes de avisar. */
export function Buscador({
  valor,
  placeholder,
  onCambio,
}: {
  valor: string;
  placeholder: string;
  onCambio: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(valor);

  useEffect(() => setTexto(valor), [valor]);

  useEffect(() => {
    if (texto.trim() === valor.trim()) return;
    const t = setTimeout(() => onCambio(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto, valor, onCambio]);

  return (
    <label className="admin-buscador">
      <Icon name="search" size={18} />
      <span className="sr-only">{placeholder}</span>
      <input type="search" value={texto} placeholder={placeholder} onChange={(e) => setTexto(e.target.value)} />
    </label>
  );
}

export function Paginacion({
  pagina,
  total,
  porPagina,
  onCambio,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  onCambio: (pagina: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  return (
    <nav className="paginacion" aria-label="Páginas">
      <button className="btn btn-secondary" disabled={pagina <= 1} onClick={() => onCambio(pagina - 1)}>
        <Icon name="chevron-left" size={18} /> Anterior
      </button>
      <span className="muted">
        Página {pagina} de {paginas}
      </span>
      <button className="btn btn-secondary" disabled={pagina >= paginas} onClick={() => onCambio(pagina + 1)}>
        Siguiente <Icon name="chevron-right" size={18} />
      </button>
    </nav>
  );
}
