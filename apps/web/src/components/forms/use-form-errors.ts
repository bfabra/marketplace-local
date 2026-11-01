import { useState } from 'react';
import { ApiError } from '@/lib/api-client';

/** Separa el error general de los errores por campo que devuelve la validación del API. */
export function useFormErrors() {
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  return {
    message,
    fields,
    clear: () => {
      setMessage(null);
      setFields({});
    },
    field: (name: string, message: string) => setFields({ [name]: message }),
    /** Quita el error de un campo (y de sus subcampos, ej. "variantes.0.precio") cuando la persona lo corrige. */
    dismiss: (name: string) =>
      setFields((actual) => {
        const claves = Object.keys(actual).filter((k) => k === name || k.startsWith(`${name}.`));
        if (claves.length === 0) return actual;
        const resto = { ...actual };
        claves.forEach((k) => delete resto[k]);
        return resto;
      }),
    set: (error: unknown) => {
      if (error instanceof ApiError) {
        setMessage(error.message);
        setFields(
          Object.fromEntries(error.details.map((d) => [d.path.replace(/^body\./, ''), d.message]))
        );
      } else {
        setMessage('Ocurrió un error inesperado');
      }
    },
  };
}
