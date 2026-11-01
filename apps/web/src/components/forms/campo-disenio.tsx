'use client';

import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';

/** Campo de la maqueta (docs/diseno, UI.field): ícono, campo y, si es contraseña, el botón para verla. */
export function CampoDisenio({
  label,
  icono,
  error,
  ayuda,
  className,
  type = 'text',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; icono?: IconName; error?: string; ayuda?: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const esClave = type === 'password';

  return (
    <label className={`ds-field${error ? ' error' : ''}${className ? ` ${className}` : ''}`}>
      <span>{label}</span>
      <div>
        {icono && <Icon name={icono} size={18} />}
        <input type={esClave && visible ? 'text' : type} aria-invalid={!!error} {...props} />
        {esClave && (
          <button
            type="button"
            className="pass-toggle"
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setVisible((v) => !v)}
          >
            <Icon name={visible ? 'eye-off' : 'eye'} size={18} />
          </button>
        )}
      </div>
      {error ? <small role="alert">{error}</small> : ayuda && <small className="ds-ayuda">{ayuda}</small>}
    </label>
  );
}

/** Lista desplegable con el estilo de los campos de la maqueta. */
export function SelectorDisenio({
  label,
  name,
  value,
  onChange,
  placeholder,
  opciones,
  error,
  disabled,
  className,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (valor: string) => void;
  placeholder: string;
  opciones: { value: string; label: string }[];
  error?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={`ds-field${error ? ' error' : ''}${className ? ` ${className}` : ''}`}>
      <span>{label}</span>
      <select name={name} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={!!error}>
        <option value="">{placeholder}</option>
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <small role="alert">{error}</small>}
    </label>
  );
}

/** Casilla de la maqueta (docs/diseno, .checkbox). */
export function CasillaDisenio({
  children,
  error,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { children: ReactNode; error?: string }) {
  return (
    <div className={`ds-casilla-campo${className ? ` ${className}` : ''}`}>
      <label className={`ds-casilla${error ? ' error' : ''}`}>
        <input type="checkbox" aria-invalid={!!error} {...props} />
        <span aria-hidden="true">
          <Icon name="check" size={12} />
        </span>
        <span className="ds-casilla-texto">{children}</span>
      </label>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

/** Aviso de la maqueta (docs/diseno, .alert). */
export function AvisoDisenio({ tipo = 'error', titulo, children }: { tipo?: 'error' | 'success'; titulo: string; children?: ReactNode }) {
  return (
    <div className={`ds-alert ${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icon name={tipo === 'error' ? 'info' : 'check'} size={17} />
      <div>
        <strong>{titulo}</strong>
        {children && <span>{children}</span>}
      </div>
    </div>
  );
}
