import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
}

export function Field({ label, name, error, ...props }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} aria-invalid={!!error} {...props} />
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: string;
  error?: string;
}

export function TextAreaField({ label, name, error, ...props }: TextAreaFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea name={name} aria-invalid={!!error} rows={3} {...props} />
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  name: string;
  error?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}

export function SelectField({ label, name, error, placeholder, options, ...props }: SelectFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} aria-invalid={!!error} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
