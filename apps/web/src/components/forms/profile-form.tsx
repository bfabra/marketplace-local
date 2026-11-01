'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, type Direccion, type Localidad, type Usuario } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Field, SelectField } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { useFormErrors } from './use-form-errors';

const PAISES = [
  { value: '+54', label: 'Argentina (+54)' },
  { value: '+591', label: 'Bolivia (+591)' },
  { value: '+56', label: 'Chile (+56)' },
  { value: '+57', label: 'Colombia (+57)' },
  { value: '+51', label: 'Perú (+51)' },
  { value: '+598', label: 'Uruguay (+598)' },
];

const TIPOS_TEL = [
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'Celular', label: 'Celular' },
  { value: 'Fijo', label: 'Fijo' },
];

function parseTel(tel: string | null | undefined) {
  const raw = (tel ?? '').trim();
  const m = raw.match(/^(\+\d{1,3}(?:\s*9)?)\s*(.+)$/);
  if (m) return { prefijo: m[1].includes('+54') ? '+54' : m[1].replace(/\s/g, ''), numero: m[2].replace(/\D/g, '') };
  return { prefijo: '+54', numero: raw.replace(/\D/g, '') };
}

function armarTel(prefijo: string, tipo: string, numero: string) {
  if (!numero) return '';
  if (prefijo === '+54' && tipo !== 'Fijo') return `+54 9 ${numero}`;
  return `${prefijo} ${numero}`.trim();
}

/** Datos personales + domicilio SJ (#profile → renderPersonalData). */
export function ProfileForm({ user }: { user: Usuario }) {
  const { setUser } = useAuth();
  const errors = useFormErrors();
  const [editando, setEditando] = useState(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [direccion, setDireccion] = useState<Direccion | null>(null);
  const telIni = parseTel(user.telefono);
  const [prefijo, setPrefijo] = useState(telIni.prefijo.startsWith('+54') ? '+54' : telIni.prefijo || '+54');
  const [tipoTel, setTipoTel] = useState('WhatsApp');

  useEffect(() => {
    api<Localidad[]>('/locations/localidades').then(setLocalidades).catch(() => {});
    api<Direccion[]>('/addresses')
      .then((lista) => setDireccion(lista.find((d) => d.es_principal) ?? lista[0] ?? null))
      .catch(() => setDireccion(null));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editando) return;
    const form = new FormData(e.currentTarget);
    const texto = (c: string) => String(form.get(c) ?? '').trim();
    errors.clear();
    setSaved(false);
    setSending(true);
    try {
      const telefono = armarTel(prefijo, tipoTel, texto('telefono_num'));
      setUser(
        await api<Usuario>('/auth/me', {
          method: 'PATCH',
          body: {
            nombre: texto('nombre'),
            apellido: texto('apellido'),
            telefono,
            dni: texto('dni'),
          },
        })
      );

      const domicilio = {
        calle: texto('calle'),
        numero: texto('numero'),
        piso_depto: texto('piso_depto') || null,
        localidad_id: texto('localidad_id'),
        referencias: [texto('barrio') && `Barrio: ${texto('barrio')}`, texto('referencias')].filter(Boolean).join(' · ') || null,
        alias: texto('barrio') || direccion?.alias || 'Casa',
        es_principal: true,
      };

      if (domicilio.calle && domicilio.numero && domicilio.localidad_id) {
        const lista = direccion
          ? await api<Direccion[]>(`/addresses/${direccion.id}`, { method: 'PUT', body: domicilio })
          : await api<Direccion[]>('/addresses', { method: 'POST', body: domicilio });
        setDireccion(lista.find((d) => d.es_principal) ?? lista[0] ?? null);
      }

      setSaved(true);
      setEditando(false);
    } catch (error) {
      errors.set(error);
    } finally {
      setSending(false);
    }
  }

  const bloqueado = !editando;
  const refs = direccion?.referencias ?? '';
  const barrioMatch = refs.match(/^Barrio:\s*([^·]+)/);
  const barrio = barrioMatch?.[1]?.trim() ?? '';
  const refsLimpias = refs.replace(/^Barrio:\s*[^·]+(?:\s*·\s*)?/, '').trim();
  const sj = localidades.filter((l) => /san juan/i.test(l.provincia));
  const opcionesLoc = (sj.length ? sj : localidades).map((l) => ({
    value: l.id,
    label: sj.length ? l.nombre : `${l.nombre} (${l.provincia})`,
  }));

  return (
    <form className={`cuenta-perfil-form${editando ? ' is-editando' : ''}`} onSubmit={onSubmit} noValidate>
      <div className="cuenta-perfil-modo">
        <span>{editando ? 'Modo edición activo' : 'Modo lectura'}</span>
      </div>

      {errors.message && <Alert>{errors.message}</Alert>}
      {saved && <Alert kind="success">Datos guardados</Alert>}

      <div className="cuenta-perfil-grid">
        <Field
          label="Nombre"
          name="nombre"
          defaultValue={user.nombre ?? ''}
          autoComplete="given-name"
          required
          disabled={bloqueado}
          readOnly={bloqueado}
          error={errors.fields.nombre}
        />
        <Field
          label="Apellido"
          name="apellido"
          defaultValue={user.apellido ?? ''}
          autoComplete="family-name"
          required
          disabled={bloqueado}
          readOnly={bloqueado}
          error={errors.fields.apellido}
        />

        <div className="cuenta-perfil-full">
          <Field
            label="Correo electrónico (no modificable)"
            name="email"
            type="email"
            defaultValue={user.email ?? ''}
            disabled
            readOnly
          />
        </div>

        <SelectField
          label="País (característica)"
          name="prefijo"
          value={prefijo}
          onChange={(e) => setPrefijo(e.target.value)}
          options={PAISES}
          disabled={bloqueado}
        />
        <SelectField
          label="Tipo de teléfono"
          name="tipo_tel"
          value={tipoTel}
          onChange={(e) => setTipoTel(e.target.value)}
          options={TIPOS_TEL}
          disabled={bloqueado}
        />

        <div className="cuenta-perfil-full">
          <Field
            label="Número de teléfono (sin 0 ni 15, ej: 2645160508)"
            name="telefono_num"
            type="tel"
            defaultValue={telIni.numero}
            placeholder="2645160508"
            disabled={bloqueado}
            readOnly={bloqueado}
            error={errors.fields.telefono}
          />
        </div>

        <Field
          label="DNI (no lo ven las tiendas)"
          name="dni"
          defaultValue={user.dni ?? ''}
          inputMode="numeric"
          maxLength={10}
          disabled={bloqueado}
          readOnly={bloqueado}
          error={errors.fields.dni}
        />
      </div>

      <div className="cuenta-domicilio">
        <h3>Domicilio de entrega para el repartidor / cadete</h3>
        <div className="cuenta-perfil-grid">
          <Field
            label="Calle / avenida"
            name="calle"
            defaultValue={direccion?.calle ?? ''}
            placeholder="Ej: Av. Libertador Gral. San Martín"
            disabled={bloqueado}
            readOnly={bloqueado}
            error={errors.fields.calle}
          />
          <Field
            label="Altura / número"
            name="numero"
            defaultValue={direccion?.numero ?? ''}
            placeholder="Ej: 1200 Oeste"
            disabled={bloqueado}
            readOnly={bloqueado}
            error={errors.fields.numero}
          />
          <Field
            label="Barrio / villa / loteo"
            name="barrio"
            defaultValue={barrio}
            placeholder="Ej: B° Copacabana"
            disabled={bloqueado}
            readOnly={bloqueado}
          />
          <Field
            label="Casa / manzana / depto (opcional)"
            name="piso_depto"
            defaultValue={direccion?.piso_depto ?? ''}
            placeholder="Ej: Casa 3, Manzana B"
            disabled={bloqueado}
            readOnly={bloqueado}
            error={errors.fields.piso_depto}
          />
          <div className="cuenta-perfil-full">
            <SelectField
              label="Departamento (San Juan)"
              name="localidad_id"
              defaultValue={direccion?.localidad.id ?? ''}
              placeholder={opcionesLoc.length ? 'Seleccioná el departamento' : 'Cargando…'}
              options={opcionesLoc}
              disabled={bloqueado}
              error={errors.fields.localidad_id}
            />
          </div>
          <div className="cuenta-perfil-full">
            <Field
              label="Referencias adicionales para el cadete"
              name="referencias"
              defaultValue={refsLimpias}
              placeholder="Ej: Portón negro, timbre rojo"
              disabled={bloqueado}
              readOnly={bloqueado}
              error={errors.fields.referencias}
            />
          </div>
        </div>
      </div>

      <div className="cuenta-perfil-acciones">
        {editando ? (
          <>
            <button
              type="button"
              className="mp-btn-secundario"
              onClick={() => {
                setEditando(false);
                errors.clear();
                setSaved(false);
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-accent" disabled={sending}>
              {sending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        ) : (
          <button type="button" className="mp-btn-editar" onClick={() => setEditando(true)}>
            Editar
          </button>
        )}
      </div>
    </form>
  );
}
