'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, type DatosDireccion, type Direccion, type Localidad } from '@/lib/api-client';
import { Field, SelectField } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { useFormErrors } from './use-form-errors';

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? '').trim() || null;

/** Alta de una dirección de entrega. Devuelve la lista actualizada y el id de la nueva. */
export function AddressForm({
  existentes,
  onSaved,
  onCancel,
}: {
  existentes: string[];
  onSaved: (direcciones: Direccion[], nueva: Direccion | undefined) => void;
  onCancel?: () => void;
}) {
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [sending, setSending] = useState(false);
  const errors = useFormErrors();

  useEffect(() => {
    api<Localidad[]>('/locations/localidades').then(setLocalidades).catch(errors.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const datos: DatosDireccion = {
      alias: texto(form, 'alias'),
      calle: String(form.get('calle') ?? ''),
      numero: String(form.get('numero') ?? ''),
      piso_depto: texto(form, 'piso_depto'),
      localidad_id: String(form.get('localidad_id') ?? ''),
      codigo_postal: texto(form, 'codigo_postal'),
      referencias: texto(form, 'referencias'),
      es_principal: form.get('es_principal') === 'on',
    };
    errors.clear();
    setSending(true);
    try {
      const lista = await api<Direccion[]>('/addresses', { method: 'POST', body: datos });
      onSaved(lista, lista.find((d) => !existentes.includes(d.id)));
    } catch (error) {
      errors.set(error);
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="stack form-plain" onSubmit={onSubmit} noValidate>
      {errors.message && <Alert>{errors.message}</Alert>}
      <div className="row">
        <Field label="Calle" name="calle" autoComplete="address-line1" required error={errors.fields.calle} />
        <Field label="Número" name="numero" required error={errors.fields.numero} />
      </div>
      <div className="row">
        <Field label="Piso y depto. (opcional)" name="piso_depto" error={errors.fields.piso_depto} />
        <Field label="Código postal (opcional)" name="codigo_postal" autoComplete="postal-code" error={errors.fields.codigo_postal} />
      </div>
      <SelectField
        label="Localidad"
        name="localidad_id"
        placeholder="Elegí tu localidad"
        options={localidades.map((l) => ({ value: l.id, label: `${l.nombre}, ${l.provincia}` }))}
        error={errors.fields.localidad_id}
      />
      <Field label="Referencias para el repartidor (opcional)" name="referencias" error={errors.fields.referencias} />
      <Field label="Nombre para reconocerla (opcional, ej.: Casa)" name="alias" error={errors.fields.alias} />
      <label className="check">
        <input type="checkbox" name="es_principal" />
        Usarla como dirección principal
      </label>
      <div className="actions">
        <button className="btn" type="submit" disabled={sending}>
          {sending ? 'Guardando…' : 'Guardar dirección'}
        </button>
        {onCancel && (
          <button className="btn btn-secondary" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
