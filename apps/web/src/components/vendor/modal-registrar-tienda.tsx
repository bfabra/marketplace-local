'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  api,
  type DatosTienda,
  type Localidad,
  type OpcionRubro,
  type TelefonoTienda,
  type Tienda,
  type TipoTelefono,
} from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { PAISES, TIPOS_TELEFONO, telefonoVacio, telefonosCargados, validarTelefonos } from '@/lib/telefonos';
import { useFormErrors } from '@/components/forms/use-form-errors';
import { Icon } from '@/components/ui/icon';
import { ModalPortal } from '@/components/vendor/modal-portal';

const MAX_LOGO = 5 * 1024 * 1024;
const TIPOS_LOGO = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_TEL = 3;

function formatearCuit(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

type Borrador = {
  nombre: string;
  cuit: string;
  telefonos: TelefonoTienda[];
  descripcion: string;
  localidad_id: string;
  direccion: string;
  rubro_id: string;
  subrubro_id: string;
};

const VACIO: Borrador = {
  nombre: '',
  cuit: '',
  telefonos: [telefonoVacio()],
  descripcion: '',
  localidad_id: '',
  direccion: '',
  rubro_id: '',
  subrubro_id: '',
};

/**
 * Modal #merchant-panel → add-store-modal (docs/diseno/js/pages/merchant.js).
 * Alta rápida de sucursal desde el panel; el onboarding completo sigue en /vendor/nueva-tienda.
 */
export function ModalRegistrarTienda({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const errors = useFormErrors();
  const [b, setB] = useState<Borrador>(VACIO);
  const [rubros, setRubros] = useState<OpcionRubro[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [logo, setLogo] = useState<{ archivo: File; url: string } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !creando && onCerrar();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [abierto, onCerrar, creando]);

  useEffect(() => {
    if (!abierto) return;
    setB(VACIO);
    setLogo(null);
    setLogoUrl(null);
    setErrorLogo(null);
    errors.clear();
    api<OpcionRubro[]>('/catalog/rubros').then(setRubros).catch(errors.set);
    api<Localidad[]>('/locations/localidades').then(setLocalidades).catch(errors.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  useEffect(
    () => () => {
      if (logo) URL.revokeObjectURL(logo.url);
    },
    [logo]
  );

  if (!abierto) return null;

  const rubro = rubros.find((r) => r.id === b.rubro_id);
  const previewLogo = logo?.url ?? logoUrl;
  const f = errors.fields;

  function poner<K extends keyof Borrador>(campo: K, valor: Borrador[K]) {
    setB((actual) => ({ ...actual, [campo]: valor }));
    errors.dismiss(String(campo));
  }

  function elegirLogo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!TIPOS_LOGO.includes(archivo.type)) return setErrorLogo('El logo tiene que ser JPG, PNG o WEBP');
    if (archivo.size > MAX_LOGO) return setErrorLogo('El logo no puede pesar más de 5 MB');
    setErrorLogo(null);
    setLogoUrl(null);
    setLogo({ archivo, url: URL.createObjectURL(archivo) });
  }

  function agregarLogoUrl() {
    const url = window.prompt('Pegá la URL de la imagen del logo:')?.trim();
    if (!url) return;
    try {
      // Validación básica de URL http(s)
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocolo');
    } catch {
      setErrorLogo('La URL del logo no es válida');
      return;
    }
    setErrorLogo(null);
    setLogo(null);
    setLogoUrl(url);
  }

  function validarLocal(borrador: Borrador) {
    const err: Record<string, string> = {};
    if (borrador.nombre.trim().length < 3) err.nombre = 'El nombre debe tener al menos 3 caracteres';
    if (borrador.cuit.replace(/\D/g, '').length !== 11) err.cuit = 'El CUIT son 11 números';
    if (!borrador.rubro_id) err.rubro_id = 'Elegí el rubro principal';
    if (!borrador.localidad_id) err.localidad_id = 'Elegí una localidad';
    if (borrador.direccion.trim().length < 5) err.direccion = 'Ingresá la dirección del local';
    return { ...err, ...validarTelefonos(borrador.telefonos) };
  }

  async function registrar() {
    errors.clear();
    const encontrados = Object.entries(validarLocal(b)).map(([path, message]) => ({ path, message }));
    if (encontrados.length > 0) {
      errors.set(new ApiError('Revisá los datos marcados', 400, encontrados));
      return;
    }
    setCreando(true);
    const datos: DatosTienda = {
      nombre: b.nombre.trim(),
      cuit: b.cuit,
      telefonos: telefonosCargados(b.telefonos),
      descripcion: b.descripcion.trim() || undefined,
      localidad_id: b.localidad_id,
      direccion: b.direccion.trim(),
      rubro_id: b.rubro_id,
      subrubro_id: b.subrubro_id || null,
    };
    try {
      const tienda = await api<Tienda>('/stores', { method: 'POST', body: datos });
      if (logo) {
        const cuerpo = new FormData();
        cuerpo.append('foto', logo.archivo);
        await api(`/stores/${tienda.id}/imagen/logo`, { method: 'POST', body: cuerpo }).catch(() => null);
      }
      await refresh();
      onCerrar();
      router.push(`/vendor/tiendas/${tienda.id}`);
    } catch (error) {
      errors.set(error);
    } finally {
      setCreando(false);
    }
  }

  const telefonos = b.telefonos.length ? b.telefonos : [telefonoVacio()];

  return (
    <ModalPortal>
    <div className="mp-modal-overlay" role="presentation" onClick={() => !creando && onCerrar()}>
      <div
        className="mp-modal mp-modal-tienda"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mp-modal-tienda-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mp-modal-cabecera">
          <h3 id="mp-modal-tienda-titulo">Registrar Nueva Tienda / Sucursal</h3>
          <button type="button" className="mp-modal-cerrar" onClick={() => !creando && onCerrar()} aria-label="Cerrar">
            <Icon name="x" size={22} />
          </button>
        </header>

        <div className="mp-modal-cuerpo mp-modal-tienda-cuerpo">
          {errors.message && (
            <p className="mp-modal-tienda-aviso" role="alert">
              {errors.message}
            </p>
          )}

          <label className={`mp-modal-field${f.nombre ? ' is-error' : ''}`}>
            <span>Nombre del comercio *</span>
            <input
              type="text"
              value={b.nombre}
              maxLength={80}
              placeholder="Ej. Almacén Libertador"
              onChange={(e) => poner('nombre', e.target.value)}
            />
            {f.nombre && <small role="alert">{f.nombre}</small>}
          </label>

          <label className={`mp-modal-field${f.cuit ? ' is-error' : ''}`}>
            <span>CUIT / CUIL *</span>
            <input
              type="text"
              value={b.cuit}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ej. 20-38492819-4"
              maxLength={13}
              onChange={(e) => poner('cuit', formatearCuit(e.target.value))}
            />
            {f.cuit && <small role="alert">{f.cuit}</small>}
          </label>

          <div className={`mp-modal-field${f.telefonos || f['telefonos.0.numero'] ? ' is-error' : ''}`}>
            <span>Teléfono(s) de contacto * (Hasta {MAX_TEL})</span>
            <div className="mp-modal-phones">
              {telefonos.map((t, idx) => {
                const errTel = f[`telefonos.${idx}.numero`];
                return (
                  <div key={idx} className="mp-modal-phone-row">
                    <select
                      aria-label={`País del teléfono ${idx + 1}`}
                      value={t.pais}
                      onChange={(e) =>
                        poner(
                          'telefonos',
                          telefonos.map((x, i) => (i === idx ? { ...x, pais: e.target.value } : x))
                        )
                      }
                    >
                      {PAISES.map((p) => (
                        <option key={p.codigo} value={p.codigo}>
                          {p.etiqueta}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Tipo del teléfono ${idx + 1}`}
                      value={t.tipo}
                      onChange={(e) =>
                        poner(
                          'telefonos',
                          telefonos.map((x, i) => (i === idx ? { ...x, tipo: e.target.value as TipoTelefono } : x))
                        )
                      }
                    >
                      {Object.entries(TIPOS_TELEFONO).map(([valor, etiqueta]) => (
                        <option key={valor} value={valor}>
                          {etiqueta}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={t.numero}
                      placeholder="Ej. 2644123456"
                      maxLength={12}
                      onChange={(e) =>
                        poner(
                          'telefonos',
                          telefonos.map((x, i) => (i === idx ? { ...x, numero: e.target.value } : x))
                        )
                      }
                    />
                    {telefonos.length > 1 ? (
                      <button
                        type="button"
                        className="mp-modal-phone-quitar"
                        aria-label="Eliminar teléfono"
                        onClick={() => poner('telefonos', telefonos.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    ) : (
                      <span className="mp-modal-phone-spacer" aria-hidden />
                    )}
                    {errTel && (
                      <small className="mp-modal-phone-err" role="alert">
                        {errTel}
                      </small>
                    )}
                  </div>
                );
              })}
            </div>
            {telefonos.length < MAX_TEL && (
              <button
                type="button"
                className="mp-modal-add-phone"
                onClick={() => poner('telefonos', [...telefonos, telefonoVacio('celular')])}
              >
                + Agregar otro teléfono (máx. {MAX_TEL})
              </button>
            )}
          </div>

          <div className="mp-modal-logo-box">
            <span>Logotipo de la Tienda</span>
            <div className="mp-modal-logo-actions">
              <label className="mp-modal-logo-file">
                Subir Archivo Local
                <input type="file" accept="image/*" className="sr-only" onChange={elegirLogo} />
              </label>
              <button type="button" className="mp-modal-logo-url" onClick={agregarLogoUrl}>
                Agregar por URL
              </button>
            </div>
            {previewLogo && (
              <div className="mp-modal-logo-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewLogo} alt="" />
                <span>Logo cargado correctamente</span>
              </div>
            )}
            {errorLogo && (
              <small className="mp-modal-logo-err" role="alert">
                {errorLogo}
              </small>
            )}
            {logoUrl && !logo && (
              <small className="mp-modal-logo-hint">La URL se muestra como vista previa; podés subir el archivo luego desde la tienda.</small>
            )}
          </div>

          <div className="mp-modal-grid-2">
            <label className={`mp-modal-field${f.rubro_id ? ' is-error' : ''}`}>
              <span>Rubro principal *</span>
              <select
                value={b.rubro_id}
                onChange={(e) => {
                  setB((actual) => ({ ...actual, rubro_id: e.target.value, subrubro_id: '' }));
                  errors.dismiss('rubro_id');
                }}
              >
                <option value="">{rubros.length ? 'Seleccioná un rubro' : 'Cargando…'}</option>
                {rubros.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
              {f.rubro_id && <small role="alert">{f.rubro_id}</small>}
            </label>
            <label className="mp-modal-field">
              <span>Subrubro (Opcional)</span>
              <select
                value={b.subrubro_id}
                disabled={!b.rubro_id}
                onChange={(e) => poner('subrubro_id', e.target.value)}
              >
                <option value="">{b.rubro_id ? 'Seleccioná un subrubro' : 'Primero elegí el rubro'}</option>
                {(rubro?.subrubros ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mp-modal-field">
            <span>Descripción (Opcional)</span>
            <textarea
              rows={2}
              maxLength={500}
              value={b.descripcion}
              placeholder="Contanos brevemente qué ofrecés y qué hace especial a tu comercio..."
              onChange={(e) => poner('descripcion', e.target.value)}
            />
          </label>

          <div className="mp-modal-grid-2">
            <label className="mp-modal-field">
              <span>Provincia *</span>
              <input type="text" value="San Juan" disabled readOnly />
            </label>
            <label className={`mp-modal-field${f.localidad_id ? ' is-error' : ''}`}>
              <span>Localidad / Villa / Zona *</span>
              <select value={b.localidad_id} onChange={(e) => poner('localidad_id', e.target.value)}>
                <option value="">{localidades.length ? 'Seleccioná la localidad' : 'Cargando…'}</option>
                {localidades.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
              {f.localidad_id && <small role="alert">{f.localidad_id}</small>}
            </label>
          </div>

          <label className={`mp-modal-field${f.direccion ? ' is-error' : ''}`}>
            <span>Calle, Altura y Detalles *</span>
            <input
              type="text"
              value={b.direccion}
              maxLength={200}
              placeholder="Ej. Av. Libertador 1240 (O)"
              onChange={(e) => poner('direccion', e.target.value)}
            />
            {f.direccion && <small role="alert">{f.direccion}</small>}
          </label>
        </div>

        <footer className="mp-modal-pie">
          <button type="button" className="mp-modal-pie-cancelar" onClick={() => !creando && onCerrar()} disabled={creando}>
            Cancelar
          </button>
          <button type="button" className="mp-modal-pie-primary" onClick={registrar} disabled={creando}>
            {creando ? 'Registrando…' : 'Registrar Tienda'}
          </button>
        </footer>
      </div>
    </div>
    </ModalPortal>
  );
}
