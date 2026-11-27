'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api, type Direccion, type Localidad, type TipoTelefono, type Usuario } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { localidadesDeDepartamento } from '@/lib/san-juan-territorio';
import {
  DIGITOS_TELEFONO_AR,
  PAISES,
  TIPOS_TELEFONO,
  armarTelefonoPerfil,
  prefijoTelefono,
  soloDigitosTelefono,
} from '@/lib/telefonos';
import { Field, SelectField } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { useFormErrors } from './use-form-errors';

/** Extrae Barrio / Zona guardados en referencias (#profile). */
function partirReferencias(refs: string | null | undefined) {
  let resto = (refs ?? '').trim();
  let barrio = '';
  let zona = '';
  const mBarrio = resto.match(/(?:^|·)\s*Barrio:\s*([^·]+)/i);
  if (mBarrio) {
    barrio = mBarrio[1].trim();
    resto = resto.replace(mBarrio[0], '').replace(/^\s*·\s*/, '').trim();
  }
  const mZona = resto.match(/(?:^|·)\s*Zona:\s*([^·]+)/i);
  if (mZona) {
    zona = mZona[1].trim();
    resto = resto.replace(mZona[0], '').replace(/^\s*·\s*/, '').trim();
  }
  return { barrio, zona, resto: resto.replace(/^\s*·\s*|\s*·\s*$/g, '').trim() };
}

function parseTel(tel: string | null | undefined) {
  const raw = (tel ?? '').trim();
  const m = raw.match(/^(\+\d{1,3})(?:\s*9)?\s*(.+)$/);
  if (m) {
    const prefijo = m[1].includes('54') ? '+54' : m[1];
    const tipo: TipoTelefono = prefijo === '+54' && /\+54\s*9|\+549/.test(raw) ? 'whatsapp' : prefijo === '+54' ? 'fijo' : 'whatsapp';
    return { prefijo, numero: m[2].replace(/\D/g, '').slice(0, DIGITOS_TELEFONO_AR), tipo };
  }
  return { prefijo: '+54', numero: raw.replace(/\D/g, '').slice(0, DIGITOS_TELEFONO_AR), tipo: 'whatsapp' as TipoTelefono };
}

type Borrador = {
  nombre: string;
  apellido: string;
  dni: string;
  prefijo: string;
  tipoTel: TipoTelefono;
  telefonoNum: string;
  calle: string;
  numero: string;
  barrio: string;
  pisoDepto: string;
  referencias: string;
  localidadId: string;
  zona: string;
};

function borradorDesde(user: Usuario, direccion: Direccion | null): Borrador {
  const tel = parseTel(user.telefono);
  const refs = partirReferencias(direccion?.referencias);
  const deptoNombre = direccion?.localidad?.nombre ?? '';
  const villas = localidadesDeDepartamento(deptoNombre);
  const zona =
    refs.zona && (villas.length === 0 || villas.includes(refs.zona)) ? refs.zona : villas[0] ?? '';
  return {
    nombre: user.nombre ?? '',
    apellido: user.apellido ?? '',
    dni: (user.dni ?? '').replace(/\D/g, '').slice(0, 8),
    prefijo: tel.prefijo.startsWith('+54') ? '+54' : tel.prefijo || '+54',
    tipoTel: tel.tipo,
    telefonoNum: tel.numero,
    calle: direccion?.calle ?? '',
    numero: direccion?.numero ?? '',
    barrio: refs.barrio,
    pisoDepto: direccion?.piso_depto ?? '',
    referencias: refs.resto,
    localidadId: direccion?.localidad?.id ?? '',
    zona,
  };
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
  const [domListo, setDomListo] = useState(false);
  const [b, setB] = useState<Borrador>(() => borradorDesde(user, null));

  function poner<K extends keyof Borrador>(campo: K, valor: Borrador[K]) {
    setB((actual) => ({ ...actual, [campo]: valor }));
  }

  useEffect(() => {
    let vivo = true;
    Promise.all([
      api<Localidad[]>('/locations/localidades').catch(() => [] as Localidad[]),
      api<Direccion[]>('/addresses').catch(() => [] as Direccion[]),
    ]).then(([locs, lista]) => {
      if (!vivo) return;
      setLocalidades(locs);
      const principal = lista.find((d) => d.es_principal) ?? lista[0] ?? null;
      setDireccion(principal);
      setB(borradorDesde(user, principal));
      setDomListo(true);
    });
    return () => {
      vivo = false;
    };
    // Solo al montar / cambiar de usuario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    if (editando) return;
    setB(borradorDesde(user, direccion));
  }, [user, direccion, editando]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editando) return;
    errors.clear();
    setSaved(false);

    const err: Record<string, string> = {};
    if (b.nombre.trim().length < 2) err.nombre = 'Ingresá tu nombre';
    if (b.apellido.trim().length < 2) err.apellido = 'Ingresá tu apellido';
    if (b.dni && !/^\d{7,8}$/.test(b.dni)) err.dni = 'El DNI son 7 u 8 números, sin puntos';
    if (!b.telefonoNum.trim()) err.telefono = 'Ingresá tu teléfono';
    else if (
      (b.prefijo === '+54' || b.prefijo.includes('+54')) &&
      b.telefonoNum.replace(/\D/g, '').length !== DIGITOS_TELEFONO_AR
    ) {
      err.telefono = `En Argentina el número tiene ${DIGITOS_TELEFONO_AR} dígitos (sin 0 ni 15)`;
    }
    if (!b.calle.trim()) err.calle = 'Ingresá la calle';
    if (!b.numero.trim()) err.numero = 'Ingresá la altura / número';
    if (!b.localidadId) err.localidad_id = 'Elegí el departamento';
    const depto = localidades.find((l) => l.id === b.localidadId);
    const villas = localidadesDeDepartamento(depto?.nombre ?? '');
    if (villas.length > 0 && !b.zona.trim()) err.zona = 'Elegí localidad / villa / zona';

    if (Object.keys(err).length) {
      errors.set(
        new ApiError(
          'Revisá los datos marcados',
          400,
          Object.entries(err).map(([path, message]) => ({ path, message }))
        )
      );
      return;
    }

    const telefono = armarTelefonoPerfil(b.prefijo, b.tipoTel, b.telefonoNum);
    if (!telefono) {
      errors.field('telefono', 'Ingresá tu teléfono');
      return;
    }

    setSending(true);
    try {
      const actualizado = await api<Usuario>('/auth/me', {
        method: 'PATCH',
        body: {
          nombre: b.nombre.trim(),
          apellido: b.apellido.trim(),
          telefono,
          dni: b.dni || null,
        },
      });
      setUser(actualizado);

      const domicilio = {
        calle: b.calle.trim(),
        numero: b.numero.trim(),
        piso_depto: b.pisoDepto.trim() || null,
        localidad_id: b.localidadId,
        referencias:
          [
            b.barrio.trim() && `Barrio: ${b.barrio.trim()}`,
            b.zona.trim() && `Zona: ${b.zona.trim()}`,
            b.referencias.trim(),
          ]
            .filter(Boolean)
            .join(' · ') || null,
        alias: b.barrio.trim() || direccion?.alias || 'Casa',
        es_principal: true,
      };

      const lista = direccion
        ? await api<Direccion[]>(`/addresses/${direccion.id}`, { method: 'PUT', body: domicilio })
        : await api<Direccion[]>('/addresses', { method: 'POST', body: domicilio });
      const actual = lista.find((d) => d.es_principal) ?? lista[0] ?? null;
      setDireccion(actual);
      setB(borradorDesde(actualizado, actual));
      setSaved(true);
      setEditando(false);
    } catch (error) {
      errors.set(error);
    } finally {
      setSending(false);
    }
  }

  function cancelar() {
    setB(borradorDesde(user, direccion));
    setEditando(false);
    errors.clear();
    setSaved(false);
  }

  const bloqueado = !editando;
  const sj = localidades.filter((l) => /san juan/i.test(l.provincia));
  const opcionesDepto = (sj.length ? sj : localidades).map((l) => ({
    value: l.id,
    label: sj.length ? l.nombre : `${l.nombre} (${l.provincia})`,
  }));
  const deptoElegido = localidades.find((l) => l.id === b.localidadId);
  const villasZona = localidadesDeDepartamento(deptoElegido?.nombre ?? '');
  const opcionesZona = villasZona.map((z) => ({ value: z, label: z }));
  const opcionesPais = PAISES.map((p) => ({ value: p.codigo, label: p.etiqueta }));
  const opcionesTipo = Object.entries(TIPOS_TELEFONO).map(([value, label]) => ({ value, label }));
  const prefijoVisible = prefijoTelefono(b.prefijo, b.tipoTel);

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
          value={b.nombre}
          onChange={(e) => {
            poner('nombre', e.target.value);
            errors.dismiss('nombre');
          }}
          autoComplete="given-name"
          required
          readOnly={bloqueado}
          error={errors.fields.nombre}
        />
        <Field
          label="Apellido"
          name="apellido"
          value={b.apellido}
          onChange={(e) => {
            poner('apellido', e.target.value);
            errors.dismiss('apellido');
          }}
          autoComplete="family-name"
          required
          readOnly={bloqueado}
          error={errors.fields.apellido}
        />

        <div className="cuenta-perfil-full">
          <Field
            label="Correo electrónico (no modificable)"
            name="email"
            type="email"
            value={user.email ?? ''}
            disabled
            readOnly
          />
        </div>

        <SelectField
          label="País (característica)"
          name="prefijo"
          value={b.prefijo}
          onChange={(e) => poner('prefijo', e.target.value)}
          options={opcionesPais}
          disabled={bloqueado}
        />
        <SelectField
          label="Tipo de teléfono"
          name="tipo_tel"
          value={b.tipoTel}
          onChange={(e) => poner('tipoTel', e.target.value as TipoTelefono)}
          options={opcionesTipo}
          disabled={bloqueado}
        />

        <div className="cuenta-perfil-full">
          <label className="field">
            <span>Número de teléfono (máx. {DIGITOS_TELEFONO_AR} dígitos, sin 0 ni 15)</span>
            <div className="telefono-numero signup-tel-numero">
              <span className="telefono-prefijo" aria-hidden="true">
                {prefijoVisible}
              </span>
              <input
                type="tel"
                name="telefono_num"
                inputMode="numeric"
                maxLength={DIGITOS_TELEFONO_AR}
                value={b.telefonoNum}
                placeholder="2645160508"
                readOnly={bloqueado}
                aria-invalid={!!errors.fields.telefono}
                onChange={(e) => {
                  poner('telefonoNum', soloDigitosTelefono(e.target.value));
                  errors.dismiss('telefono');
                }}
              />
            </div>
            {errors.fields.telefono && <small className="field-error">{errors.fields.telefono}</small>}
          </label>
        </div>

        <Field
          label="DNI (7 u 8 números, sin puntos)"
          name="dni"
          value={b.dni}
          inputMode="numeric"
          maxLength={8}
          readOnly={bloqueado}
          error={errors.fields.dni}
          onChange={(e) => {
            poner('dni', e.target.value.replace(/\D/g, '').slice(0, 8));
            errors.dismiss('dni');
          }}
        />
      </div>

      <div className="cuenta-domicilio">
        <h3>Domicilio de Entrega para el Repartidor / Cadete</h3>
        {!domListo ? (
          <p className="muted">Cargando domicilio…</p>
        ) : (
          <div className="cuenta-perfil-grid">
            <Field
              label="Calle / avenida"
              name="calle"
              value={b.calle}
              onChange={(e) => {
                poner('calle', e.target.value);
                errors.dismiss('calle');
              }}
              placeholder="Ej: Av. Libertador Gral. San Martín"
              readOnly={bloqueado}
              error={errors.fields.calle}
            />
            <Field
              label="Altura / número"
              name="numero"
              value={b.numero}
              onChange={(e) => {
                poner('numero', e.target.value);
                errors.dismiss('numero');
              }}
              placeholder="Ej: 1200 Oeste"
              readOnly={bloqueado}
              error={errors.fields.numero}
            />
            <Field
              label="Barrio / villa / loteo"
              name="barrio"
              value={b.barrio}
              onChange={(e) => poner('barrio', e.target.value)}
              placeholder="Ej: B° Copacabana"
              readOnly={bloqueado}
            />
            <Field
              label="Casa / manzana / depto (opcional)"
              name="piso_depto"
              value={b.pisoDepto}
              onChange={(e) => poner('pisoDepto', e.target.value)}
              placeholder="Ej: Casa 3, Manzana B"
              readOnly={bloqueado}
              error={errors.fields.piso_depto}
            />
            <SelectField
              label="Departamento (San Juan)"
              name="localidad_id"
              value={b.localidadId}
              onChange={(e) => {
                const id = e.target.value;
                const depto = localidades.find((l) => l.id === id);
                const villas = localidadesDeDepartamento(depto?.nombre ?? '');
                setB((actual) => ({
                  ...actual,
                  localidadId: id,
                  zona: villas[0] ?? '',
                }));
                errors.dismiss('localidad_id');
                errors.dismiss('zona');
              }}
              placeholder={opcionesDepto.length ? 'Seleccioná el departamento' : 'Cargando…'}
              options={opcionesDepto}
              disabled={bloqueado}
              error={errors.fields.localidad_id}
            />
            <SelectField
              label="Localidad / Villa / Zona"
              name="zona"
              value={b.zona}
              onChange={(e) => {
                poner('zona', e.target.value);
                errors.dismiss('zona');
              }}
              placeholder={
                !b.localidadId
                  ? 'Primero elegí el departamento'
                  : opcionesZona.length
                    ? 'Seleccioná localidad'
                    : 'Sin localidades cargadas'
              }
              options={opcionesZona}
              disabled={bloqueado || !b.localidadId || opcionesZona.length === 0}
              error={errors.fields.zona}
            />
            <div className="cuenta-perfil-full">
              <Field
                label="Referencias adicionales para el cadete"
                name="referencias"
                value={b.referencias}
                onChange={(e) => poner('referencias', e.target.value)}
                placeholder="Ej: Portón negro, timbre rojo"
                readOnly={bloqueado}
                error={errors.fields.referencias}
              />
            </div>
          </div>
        )}
      </div>

      <div className="cuenta-perfil-acciones">
        {editando ? (
          <>
            <button type="button" className="mp-btn-secundario" onClick={cancelar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-accent" disabled={sending}>
              {sending ? 'Guardando…' : 'Guardar Cambios'}
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
