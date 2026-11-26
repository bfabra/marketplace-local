'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  api,
  type DatosTienda,
  type Localidad,
  type LugarGoogle,
  type OpcionRubro,
  type TelefonoTienda,
  type Tienda,
  type TipoTelefono,
  type Ubicacion,
} from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useOpciones } from '@/hooks/use-opciones';
import {
  DIGITOS_TELEFONO_AR,
  PAISES,
  TIPOS_TELEFONO,
  prefijoTelefono,
  soloDigitosTelefono,
  telefonoVacio,
  telefonosCargados,
  validarTelefonos,
} from '@/lib/telefonos';
import { useFormErrors } from '@/components/forms/use-form-errors';
import { UbicacionTienda } from '@/components/forms/ubicacion-tienda';
import { Icon } from '@/components/ui/icon';
import { ModalPortal } from '@/components/vendor/modal-portal';
import { cuitValido, formatearCuit, mensajeCuitInvalido } from '@/lib/cuit';
import {
  direccionConZona,
  localidadesDeDepartamento,
  zonaDesdeDireccion,
} from '@/lib/san-juan-territorio';

const MAX_LOGO = 5 * 1024 * 1024;
const TIPOS_LOGO = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_TEL = 3;

type Borrador = {
  nombre: string;
  cuit: string;
  telefonos: TelefonoTienda[];
  descripcion: string;
  localidad_id: string;
  zona: string;
  direccion: string;
  ubicacion: Ubicacion | null;
  rubro_id: string;
  subrubro_id: string;
};

const VACIO: Borrador = {
  nombre: '',
  cuit: '',
  telefonos: [telefonoVacio()],
  descripcion: '',
  localidad_id: '',
  zona: '',
  direccion: '',
  ubicacion: null,
  rubro_id: '',
  subrubro_id: '',
};

function borradorDesdeTienda(t: Tienda): Borrador {
  const zona = zonaDesdeDireccion(t.direccion);
  const villas = localidadesDeDepartamento(t.localidad.nombre);
  return {
    nombre: t.nombre,
    cuit: formatearCuit(t.cuit),
    telefonos: t.telefonos.length ? t.telefonos.map((x) => ({ ...x })) : [telefonoVacio()],
    descripcion: t.descripcion ?? '',
    localidad_id: t.localidad.id,
    zona: zona || (villas.includes(t.localidad.nombre) ? t.localidad.nombre : villas[0] ?? ''),
    direccion: t.direccion.replace(/\s*·\s*Zona:\s*.+$/i, '').trim(),
    ubicacion: t.ubicacion ?? null,
    rubro_id: t.rubro?.id ?? '',
    subrubro_id: t.subrubro?.id ?? '',
  };
}

/**
 * Modal #merchant-panel → add/edit-store-modal (docs/diseno/js/pages/merchant.js).
 * Alta o edición rápida de sucursal desde el panel (mismo popup).
 */
export function ModalRegistrarTienda({
  abierto,
  onCerrar,
  tienda,
  onGuardado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  /** Si viene, el modal edita esa sucursal; si no, registra una nueva. */
  tienda?: Tienda | null;
  onGuardado?: (tienda: Tienda) => void;
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const opciones = useOpciones();
  const errors = useFormErrors();
  const [b, setB] = useState<Borrador>(() => (tienda ? borradorDesdeTienda(tienda) : VACIO));
  const [rubros, setRubros] = useState<OpcionRubro[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [logo, setLogo] = useState<{ archivo: File; url: string } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(() => tienda?.logo ?? null);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [provinciaModal, setProvinciaModal] = useState(tienda?.localidad?.provincia || 'San Juan');
  const editando = !!tienda;

  const provinciasModal = [...new Set(localidades.map((l) => l.provincia))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
  const departamentosModal = localidades
    .filter((l) => l.provincia === provinciaModal)
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const deptoElegido = localidades.find((l) => l.id === b.localidad_id);
  const villasZona = localidadesDeDepartamento(deptoElegido?.nombre ?? '');

  useEffect(() => {
    if (!abierto) return;
    // Escape no cierra: un cierre accidental borraría el formulario (solo X / Cancelar).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.stopPropagation();
    };
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
    setLogo(null);
    setErrorLogo(null);
    errors.clear();
    if (tienda) {
      setB(borradorDesdeTienda(tienda));
      setLogoUrl(tienda.logo);
      setProvinciaModal(tienda.localidad?.provincia || 'San Juan');
    } else {
      setB(VACIO);
      setLogoUrl(null);
      setProvinciaModal('San Juan');
    }
    api<OpcionRubro[]>('/catalog/rubros').then(setRubros).catch(errors.set);
    api<Localidad[]>('/locations/localidades')
      .then((lista) => {
        setLocalidades(lista);
        if (tienda) {
          setProvinciaModal(tienda.localidad?.provincia || 'San Juan');
        } else {
          const primera = [...new Set(lista.map((l) => l.provincia))].sort((a, b) => a.localeCompare(b, 'es'))[0];
          if (primera) setProvinciaModal(primera);
        }
      })
      .catch(errors.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, tienda?.id]);

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
    setLogo((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { archivo, url: URL.createObjectURL(archivo) };
    });
  }

  function agregarLogoUrl() {
    const url = window.prompt('Pegá la URL de la imagen del logo:')?.trim();
    if (!url) return;
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocolo');
    } catch {
      setErrorLogo('La URL del logo no es válida');
      return;
    }
    setErrorLogo(null);
    setLogo((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setLogoUrl(url);
  }

  function quitarLogo() {
    setLogo((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setLogoUrl(null);
    setErrorLogo(null);
  }

  async function archivoDesdeUrl(url: string): Promise<File> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch');
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('tipo');
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `logo.${ext}`, { type: blob.type });
  }

  async function subirLogo(tiendaId: string) {
    let archivo = logo?.archivo ?? null;
    if (!archivo && logoUrl && logoUrl !== tienda?.logo) {
      try {
        archivo = await archivoDesdeUrl(logoUrl);
      } catch {
        throw new ApiError(
          'No pudimos bajar el logo desde esa URL. Subí el archivo con “Subir Archivo Local”.',
          400
        );
      }
    }
    if (!archivo) return null;
    const cuerpo = new FormData();
    cuerpo.append('foto', archivo);
    return api<Tienda>(`/stores/${tiendaId}/imagen/logo`, { method: 'POST', body: cuerpo });
  }

  function validarLocal(borrador: Borrador) {
    const err: Record<string, string> = {};
    if (borrador.nombre.trim().length < 3) err.nombre = 'El nombre debe tener al menos 3 caracteres';
    if (!cuitValido(borrador.cuit)) err.cuit = mensajeCuitInvalido(borrador.cuit);
    if (!telefonosCargados(borrador.telefonos).length) {
      err['telefonos.0.numero'] = 'Agregá al menos un teléfono de contacto';
    }
    if (!borrador.rubro_id) err.rubro_id = 'Elegí el rubro principal';
    if (!borrador.localidad_id) err.localidad_id = 'Elegí un departamento';
    const depto = localidades.find((l) => l.id === borrador.localidad_id);
    const villas = localidadesDeDepartamento(depto?.nombre ?? '');
    if (villas.length > 0 && !borrador.zona.trim()) err.zona = 'Elegí localidad / villa / zona';
    if (borrador.direccion.trim().length < 5) err.direccion = 'Ingresá la dirección del local';
    return { ...err, ...validarTelefonos(borrador.telefonos) };
  }

  /** Completa dirección/coords desde Google sin pisar lo ya cargado (salvo la calle). */
  function importarDesdeMaps(lugar: LugarGoogle) {
    setB((actual) => {
      const cargados = telefonosCargados(actual.telefonos);
      const yaEsta =
        lugar.telefono &&
        cargados.some(
          (t) => t.numero.replace(/\D/g, '') === lugar.telefono!.numero.replace(/\D/g, '')
        );
      const depto = localidades.find((l) => l.id === (lugar.localidad?.id ?? actual.localidad_id));
      const villas = localidadesDeDepartamento(depto?.nombre ?? '');
      return {
        ...actual,
        nombre: actual.nombre.trim() ? actual.nombre : lugar.nombre.slice(0, 80),
        direccion: lugar.direccion.slice(0, 200),
        localidad_id: lugar.localidad?.id ?? actual.localidad_id,
        zona: actual.zona || villas[0] || actual.zona,
        ubicacion: lugar.ubicacion,
        telefonos: lugar.telefono && !yaEsta ? [...cargados, lugar.telefono].slice(0, MAX_TEL) : actual.telefonos,
      };
    });
    ['nombre', 'direccion', 'localidad_id', 'zona', 'telefonos'].forEach(errors.dismiss);
  }

  async function guardar() {
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
      direccion: direccionConZona(b.direccion, b.zona),
      ubicacion: b.ubicacion,
      rubro_id: b.rubro_id,
      subrubro_id: b.subrubro_id || null,
    };
    try {
      let guardada: Tienda;
      if (editando && tienda) {
        guardada = await api<Tienda>(`/stores/${tienda.id}`, { method: 'PATCH', body: datos });
      } else {
        guardada = await api<Tienda>('/stores', { method: 'POST', body: datos });
      }
      if (logo || (logoUrl && logoUrl !== tienda?.logo)) {
        try {
          const conLogo = await subirLogo(guardada.id);
          if (conLogo) guardada = conLogo;
        } catch (logoErr) {
          errors.set(logoErr);
          onGuardado?.(guardada);
          return;
        }
      }
      await refresh();
      onGuardado?.(guardada);
      onCerrar();
      if (!editando) router.push(`/vendor/tiendas/${guardada.id}`);
    } catch (error) {
      errors.set(error);
    } finally {
      setCreando(false);
    }
  }

  const telefonos = b.telefonos.length ? b.telefonos : [telefonoVacio()];

  return (
    <ModalPortal>
    <div className="mp-modal-overlay" role="presentation">
      <div
        className="mp-modal mp-modal-tienda"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mp-modal-tienda-titulo"
      >
        <header className="mp-modal-cabecera">
          <h3 id="mp-modal-tienda-titulo">
            {editando ? `Editar Sucursal: ${tienda?.nombre ?? ''}` : 'Registrar Nueva Tienda / Sucursal'}
          </h3>
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
              placeholder="Ej. 20-12345678-6"
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
                    <div className="mp-modal-phone-numero">
                      <span className="mp-modal-phone-prefijo" aria-hidden="true">
                        {prefijoTelefono(t.pais, t.tipo)}
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={t.numero}
                        placeholder="Ej. 2644123456"
                        maxLength={DIGITOS_TELEFONO_AR}
                        aria-label={`Número del teléfono ${idx + 1}`}
                        onChange={(e) =>
                          poner(
                            'telefonos',
                            telefonos.map((x, i) =>
                              i === idx ? { ...x, numero: soloDigitosTelefono(e.target.value) } : x
                            )
                          )
                        }
                      />
                    </div>
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
            <small className="mp-modal-phone-ayuda">
              En Argentina son {DIGITOS_TELEFONO_AR} dígitos (área + número), sin el 0 ni el 15.
            </small>
          </div>

          <div className="mp-modal-logo-box">
            <span>Logotipo de la Tienda</span>
            <div className="mp-modal-logo-actions">
              <label className="mp-modal-logo-file" htmlFor="mp-modal-logo-input">
                Subir Archivo Local
                <input
                  id="mp-modal-logo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mp-modal-logo-input"
                  onChange={elegirLogo}
                />
              </label>
              <button type="button" className="mp-modal-logo-url" onClick={agregarLogoUrl}>
                Agregar por URL
              </button>
              {previewLogo && (
                <button type="button" className="mp-modal-logo-quitar" onClick={quitarLogo}>
                  Quitar logo
                </button>
              )}
            </div>
            {previewLogo && (
              <div className="mp-modal-logo-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewLogo} alt="" />
                <span>Logo listo para guardar</span>
              </div>
            )}
            {errorLogo && (
              <small className="mp-modal-logo-err" role="alert">
                {errorLogo}
              </small>
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
              <select
                value={provinciaModal}
                onChange={(e) => {
                  setProvinciaModal(e.target.value);
                  if (b.localidad_id) {
                    const ok = localidades.some((l) => l.id === b.localidad_id && l.provincia === e.target.value);
                    if (!ok) {
                      setB((actual) => ({ ...actual, localidad_id: '', zona: '' }));
                    }
                  }
                }}
              >
                {provinciasModal.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className={`mp-modal-field${f.localidad_id ? ' is-error' : ''}`}>
              <span>Departamento en San Juan *</span>
              <select
                value={b.localidad_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const depto = localidades.find((l) => l.id === id);
                  const villas = localidadesDeDepartamento(depto?.nombre ?? '');
                  setB((actual) => ({
                    ...actual,
                    localidad_id: id,
                    zona: villas[0] ?? '',
                  }));
                  errors.dismiss('localidad_id');
                  errors.dismiss('zona');
                }}
              >
                <option value="">
                  {departamentosModal.length ? 'Seleccioná departamento' : 'Cargando…'}
                </option>
                {departamentosModal.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
              {f.localidad_id && <small role="alert">{f.localidad_id}</small>}
            </label>
          </div>

          <label className={`mp-modal-field${f.zona ? ' is-error' : ''}`}>
            <span>Localidad / Villa / Zona *</span>
            <select
              value={b.zona}
              disabled={!b.localidad_id || villasZona.length === 0}
              onChange={(e) => poner('zona', e.target.value)}
            >
              <option value="">
                {!b.localidad_id
                  ? 'Primero elegí el departamento'
                  : villasZona.length
                    ? 'Seleccioná localidad'
                    : 'Sin localidades cargadas'}
              </option>
              {villasZona.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            {f.zona && <small role="alert">{f.zona}</small>}
          </label>

          <div className="mp-modal-ubicacion">
            <UbicacionTienda
              conGoogleMaps={!!opciones?.googleMaps}
              ubicacion={b.ubicacion}
              nombre={b.nombre}
              onImportar={importarDesdeMaps}
              onUbicacion={(ubicacion) => setB((actual) => ({ ...actual, ubicacion }))}
              onQuitarUbicacion={() => setB((actual) => ({ ...actual, ubicacion: null }))}
            >
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
            </UbicacionTienda>
          </div>
        </div>

        <footer className="mp-modal-pie">
          <button type="button" className="mp-modal-pie-cancelar" onClick={() => !creando && onCerrar()} disabled={creando}>
            Cancelar
          </button>
          <button type="button" className="mp-modal-pie-primary" onClick={guardar} disabled={creando}>
            {creando ? (editando ? 'Guardando…' : 'Registrando…') : editando ? 'Guardar Cambios' : 'Registrar Tienda'}
          </button>
        </footer>
      </div>
    </div>
    </ModalPortal>
  );
}
