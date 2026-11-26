'use client';

import { useEffect, useState } from 'react';
import { ApiError, api, type Direccion, type Localidad, type Usuario } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useFormErrors } from '@/components/forms/use-form-errors';
import { Icon } from '@/components/ui/icon';
import { ModalPortal } from '@/components/vendor/modal-portal';

/**
 * Modal #merchant-panel → edit-merchant-profile-modal
 * (docs/diseno/js/pages/merchant.js).
 */
export function ModalEditarDatosPersonales({
  abierto,
  onCerrar,
  direccion,
  onGuardado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  direccion: Direccion | null;
  onGuardado?: (user: Usuario, direccion: Direccion | null) => void;
}) {
  const { user, setUser, refresh } = useAuth();
  const errors = useFormErrors();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [direccionTxt, setDireccionTxt] = useState('');
  const [telefono, setTelefono] = useState('');
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    // Escape no cierra: evita perder datos del formulario (solo X / Cancelar).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.stopPropagation();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [abierto, onCerrar, guardando]);

  useEffect(() => {
    if (!abierto || !user) return;
    errors.clear();
    setNombre(user.nombre ?? '');
    setApellido(user.apellido ?? '');
    {
      const doc = (user.dni ?? '').replace(/\D/g, '');
      if (doc.length === 11) setDni(`${doc.slice(0, 2)}-${doc.slice(2, 10)}-${doc.slice(10)}`);
      else if (doc.length > 2 && doc.length <= 10) setDni(`${doc.slice(0, 2)}-${doc.slice(2)}`);
      else setDni(doc);
    }
    setTelefono(user.telefono ?? '');
    setDireccionTxt(
      direccion
        ? `${direccion.calle} ${direccion.numero}${direccion.piso_depto ? `, ${direccion.piso_depto}` : ''}, ${direccion.localidad.nombre}`
        : ''
    );
    api<Localidad[]>('/locations/localidades')
      .then(setLocalidades)
      .catch(() => setLocalidades([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, user?.id, direccion?.id]);

  if (!abierto) return null;

  const f = errors.fields;

  async function guardar() {
    errors.clear();
    const err: Record<string, string> = {};
    const doc = dni.replace(/\D/g, '');
    if (nombre.trim().length < 2) err.nombre = 'Ingresá tu nombre';
    if (apellido.trim().length < 2) err.apellido = 'Ingresá tu apellido';
    if (!doc || (doc.length !== 7 && doc.length !== 8 && doc.length !== 11)) {
      err.dni = 'Ingresá un CUIT/CUIL de 11 números (o DNI de 7 u 8)';
    }
    if (!telefono.trim()) err.telefono = 'Ingresá tu teléfono';
    if (!direccionTxt.trim()) err.direccion = 'Ingresá tu dirección personal';
    if (Object.keys(err).length) {
      errors.set(new ApiError('Revisá los datos marcados', 400, Object.entries(err).map(([path, message]) => ({ path, message }))));
      return;
    }

    setGuardando(true);
    try {
      const actualizado = await api<Usuario>('/auth/me', {
        method: 'PATCH',
        body: {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          telefono: telefono.trim(),
          dni: dni.replace(/\D/g, '') || null,
        },
      });
      setUser(actualizado);

      let dirActual = direccion;
      const localidadId =
        direccion?.localidad.id ||
        localidades.find((l) => /capital/i.test(l.nombre) && /san juan/i.test(l.provincia))?.id ||
        localidades[0]?.id;

      if (localidadId) {
        const cuerpo = {
          calle: direccionTxt.trim(),
          numero: direccion?.numero?.trim() || 'S/N',
          piso_depto: direccion?.piso_depto ?? null,
          localidad_id: localidadId,
          referencias: direccion?.referencias ?? null,
          alias: direccion?.alias || 'Casa',
          es_principal: true,
        };
        const lista = direccion
          ? await api<Direccion[]>(`/addresses/${direccion.id}`, { method: 'PUT', body: cuerpo })
          : await api<Direccion[]>('/addresses', { method: 'POST', body: cuerpo });
        dirActual = lista.find((d) => d.es_principal) ?? lista[0] ?? null;
      }

      await refresh();
      onGuardado?.(actualizado, dirActual);
      onCerrar();
    } catch (e) {
      errors.set(e);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalPortal>
      <div className="mp-modal-overlay" role="presentation">
        <div
          className="mp-modal mp-modal-perfil"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mp-modal-perfil-titulo"
        >
          <header className="mp-modal-cabecera">
            <h3 id="mp-modal-perfil-titulo">Editar Datos Personales del Comerciante</h3>
            <button
              type="button"
              className="mp-modal-cerrar"
              onClick={() => !guardando && onCerrar()}
              aria-label="Cerrar"
            >
              <Icon name="x" size={22} />
            </button>
          </header>

          <div className="mp-modal-cuerpo">
            {errors.message && (
              <p className="mp-modal-tienda-aviso" role="alert">
                {errors.message}
              </p>
            )}

            <div className="mp-modal-grid-2">
              <label className={`mp-modal-field${f.nombre ? ' is-error' : ''}`}>
                <span>Nombre *</span>
                <input type="text" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} />
                {f.nombre && <small role="alert">{f.nombre}</small>}
              </label>
              <label className={`mp-modal-field${f.apellido ? ' is-error' : ''}`}>
                <span>Apellido *</span>
                <input type="text" value={apellido} maxLength={80} onChange={(e) => setApellido(e.target.value)} />
                {f.apellido && <small role="alert">{f.apellido}</small>}
              </label>
            </div>

            <label className={`mp-modal-field${f.dni ? ' is-error' : ''}`}>
              <span>Número de CUIT / CUIL *</span>
              <input
                type="text"
                value={dni}
                inputMode="numeric"
                maxLength={13}
                placeholder="Ej. 20-32114455-8"
                onChange={(e) => {
                  const digitos = e.target.value.replace(/\D/g, '').slice(0, 11);
                  if (digitos.length <= 2) setDni(digitos);
                  else if (digitos.length <= 10) setDni(`${digitos.slice(0, 2)}-${digitos.slice(2)}`);
                  else setDni(`${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`);
                }}
              />
              {f.dni && <small role="alert">{f.dni}</small>}
            </label>

            <label className={`mp-modal-field${f.direccion ? ' is-error' : ''}`}>
              <span>Dirección Personal *</span>
              <input
                type="text"
                value={direccionTxt}
                maxLength={200}
                placeholder="Ej. Av. Libertador 1240, Capital"
                onChange={(e) => setDireccionTxt(e.target.value)}
              />
              {f.direccion && <small role="alert">{f.direccion}</small>}
            </label>

            <label className={`mp-modal-field${f.telefono ? ' is-error' : ''}`}>
              <span>Teléfono Personal *</span>
              <input
                type="tel"
                value={telefono}
                maxLength={40}
                placeholder="Ej. +54 9 264 5891234"
                onChange={(e) => setTelefono(e.target.value)}
              />
              {f.telefono && <small role="alert">{f.telefono}</small>}
            </label>
          </div>

          <footer className="mp-modal-pie">
            <button type="button" className="mp-modal-pie-cancelar" onClick={() => !guardando && onCerrar()} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" className="mp-modal-pie-primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar Cambios'}
            </button>
          </footer>
        </div>
      </div>
    </ModalPortal>
  );
}
