'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api, type DatosTienda, type Localidad, type LugarGoogle, type TelefonoTienda, type Tienda } from '@/lib/api-client';
import { useOpciones } from '@/hooks/use-opciones';
import { telefonoVacio, telefonosCargados, validarTelefonos } from '@/lib/telefonos';
import { Field, SelectField, TextAreaField } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { useFormErrors } from './use-form-errors';
import { RubroSelector, valorRubroDe } from './rubro-selector';
import { TelefonosTienda } from './telefonos-tienda';
import { UbicacionTienda } from './ubicacion-tienda';

interface StoreFormProps {
  title: string;
  submitLabel: string;
  sendingLabel: string;
  tienda?: Tienda;
  onSubmit: (datos: DatosTienda) => Promise<void>;
  successMessage?: string;
}

export function StoreForm({ title, submitLabel, sendingLabel, tienda, onSubmit, successMessage }: StoreFormProps) {
  const errors = useFormErrors();
  const opciones = useOpciones();
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [rubro, setRubro] = useState(() => valorRubroDe(tienda));
  const [telefonos, setTelefonos] = useState<TelefonoTienda[]>(() => (tienda?.telefonos.length ? tienda.telefonos : [telefonoVacio()]));
  const [ubicacion, setUbicacion] = useState(tienda?.ubicacion ?? null);
  const [localidad, setLocalidad] = useState(tienda?.localidad.id ?? '');
  const [direccion, setDireccion] = useState(tienda?.direccion ?? '');

  useEffect(() => {
    api<Localidad[]>('/locations/localidades').then(setLocalidades).catch(errors.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function importar(lugar: LugarGoogle) {
    setDireccion(lugar.direccion.slice(0, 200));
    if (lugar.localidad) setLocalidad(lugar.localidad.id);
    setUbicacion(lugar.ubicacion);
    const cargados = telefonosCargados(telefonos);
    const nuevo = lugar.telefono;
    if (nuevo && !cargados.some((t) => t.numero.replace(/\D/g, '') === nuevo.numero.replace(/\D/g, '')))
      setTelefonos([...cargados, nuevo].slice(0, 5));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const texto = (campo: string) => String(form.get(campo) ?? '');
    errors.clear();
    setSaved(false);
    const erroresTelefonos = Object.entries(validarTelefonos(telefonos)).map(([path, message]) => ({ path, message }));
    if (erroresTelefonos.length) {
      errors.set(new ApiError('Revisá los teléfonos marcados en rojo', 400, erroresTelefonos));
      return;
    }
    setSending(true);
    try {
      await onSubmit({
        nombre: texto('nombre'),
        descripcion: texto('descripcion'),
        cuit: texto('cuit'),
        razon_social: texto('razon_social'),
        telefonos,
        ubicacion,
        email: texto('email'),
        localidad_id: localidad,
        direccion,
        rubro_id: rubro.rubro_id,
        subrubro_id: rubro.subrubro_id || null,
        especialidades: rubro.especialidades,
      });
      setSaved(true);
    } catch (error) {
      errors.set(error);
    } finally {
      setSending(false);
    }
  }

  const f = errors.fields;

  return (
    <form className="card form form-wide" onSubmit={handleSubmit} noValidate>
      <h2>{title}</h2>
      {errors.message && <Alert>{errors.message}</Alert>}
      {saved && successMessage && <Alert kind="success">{successMessage}</Alert>}

      <Field label="Nombre de la tienda" name="nombre" defaultValue={tienda?.nombre} required error={f.nombre} />
      <TextAreaField
        label="Descripción (opcional)"
        name="descripcion"
        defaultValue={tienda?.descripcion ?? ''}
        placeholder="Qué vendés, desde cuándo, qué te diferencia…"
        error={f.descripcion}
      />

      <RubroSelector value={rubro} onChange={setRubro} tienda={tienda} errors={f} onError={errors.set} />

      <div className="row">
        <Field label="CUIT" name="cuit" defaultValue={tienda?.cuit} placeholder="20-12345678-6" inputMode="numeric" required error={f.cuit} />
        <Field label="Razón social (opcional)" name="razon_social" defaultValue={tienda?.razon_social ?? ''} error={f.razon_social} />
      </div>

      <TelefonosTienda
        valor={telefonos}
        onChange={(lista) => {
          setTelefonos(lista);
          errors.dismiss('telefonos');
        }}
        errores={f}
      />
      <Field label="Correo de la tienda (opcional)" name="email" type="email" defaultValue={tienda?.email ?? ''} error={f.email} />

      <UbicacionTienda
        conGoogleMaps={!!opciones?.googleMaps}
        ubicacion={ubicacion}
        nombre={tienda?.nombre ?? ''}
        onImportar={importar}
        onQuitarUbicacion={() => setUbicacion(null)}
      >
        <div className="row">
          <SelectField
            label="Localidad"
            name="localidad_id"
            value={localidad}
            onChange={(e) => setLocalidad(e.target.value)}
            placeholder={localidades.length ? 'Elegí una localidad' : 'Cargando…'}
            options={localidades.map((l) => ({ value: l.id, label: `${l.nombre} (${l.provincia})` }))}
            required
            error={f.localidad_id}
          />
          <Field
            label="Dirección del local"
            name="direccion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Calle y número"
            maxLength={200}
            required
            error={f.direccion}
          />
        </div>
      </UbicacionTienda>

      <button className="btn" type="submit" disabled={sending}>
        {sending ? sendingLabel : submitLabel}
      </button>
    </form>
  );
}
