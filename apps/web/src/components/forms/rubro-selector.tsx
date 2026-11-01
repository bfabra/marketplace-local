'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { api, type OpcionRubro, type Tienda } from '@/lib/api-client';
import { SelectField } from '@/components/ui/field';

export interface ValorRubro {
  rubro_id: string;
  subrubro_id: string;
  especialidades: string[];
}

export const valorRubroDe = (tienda?: Tienda): ValorRubro => ({
  rubro_id: tienda?.rubro?.id ?? '',
  subrubro_id: tienda?.subrubro?.id ?? '',
  especialidades: tienda?.especialidades.map((e) => e.id) ?? [],
});

interface Props {
  value: ValorRubro;
  onChange: Dispatch<SetStateAction<ValorRubro>>;
  /** Para mostrar lo que la tienda ya tenía aunque el superadmin lo haya desactivado. */
  tienda?: Tienda;
  errors: Partial<Record<'rubro_id' | 'subrubro_id' | 'especialidades', string>>;
  onError: (error: unknown) => void;
}

export function RubroSelector({ value, onChange, tienda, errors, onError }: Props) {
  const [rubros, setRubros] = useState<OpcionRubro[] | null>(null);

  useEffect(() => {
    api<OpcionRubro[]>('/catalog/rubros').then(setRubros).catch(onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lista = rubros ?? [];
  const rubro = lista.find((r) => r.id === value.rubro_id);
  const subrubro = rubro?.subrubros.find((s) => s.id === value.subrubro_id);

  const opcionesRubro = lista.map((r) => ({ value: r.id, label: r.nombre }));
  if (tienda?.rubro && !lista.some((r) => r.id === tienda.rubro!.id)) {
    opcionesRubro.push({ value: tienda.rubro.id, label: `${tienda.rubro.nombre} (ya no se ofrece)` });
  }
  const opcionesSub = (rubro?.subrubros ?? []).map((s) => ({ value: s.id, label: s.nombre }));
  if (tienda?.subrubro && value.rubro_id === tienda.rubro?.id && !opcionesSub.some((o) => o.value === tienda.subrubro!.id)) {
    opcionesSub.push({ value: tienda.subrubro.id, label: `${tienda.subrubro.nombre} (ya no se ofrece)` });
  }

  const alternar = (id: string) =>
    onChange((v) => ({
      ...v,
      especialidades: v.especialidades.includes(id)
        ? v.especialidades.filter((x) => x !== id)
        : [...v.especialidades, id],
    }));

  return (
    <fieldset className="fieldset-plain rubro-selector">
      <legend className="rubro-titulo">Rubro del negocio</legend>
      <p className="field-hint">Ayuda a que los clientes encuentren tu tienda y entiendan qué ofrecés.</p>
      <div className="row">
        <SelectField
          label="Rubro principal"
          name="rubro_id"
          value={value.rubro_id}
          onChange={(e) => onChange({ rubro_id: e.target.value, subrubro_id: '', especialidades: [] })}
          placeholder={rubros ? 'Elegí el rubro principal' : 'Cargando…'}
          options={opcionesRubro}
          required
          error={errors.rubro_id}
        />
        <SelectField
          label="Subrubro (opcional)"
          name="subrubro_id"
          value={value.subrubro_id}
          onChange={(e) => {
            const subrubro_id = e.target.value;
            onChange((v) => ({ ...v, subrubro_id, especialidades: [] }));
          }}
          placeholder={value.rubro_id ? 'Ninguno me representa' : 'Primero elegí el rubro'}
          options={opcionesSub}
          disabled={!value.rubro_id}
          error={errors.subrubro_id}
        />
      </div>

      {subrubro && subrubro.especialidades.length > 0 && (
        <div className="field">
          <span>
            ¿Qué ofrecés? <span className="field-hint">(opcional, marcá todas las que correspondan)</span>
          </span>
          <div className="chips" role="group" aria-label={`Especialidades de ${subrubro.nombre}`}>
            {subrubro.especialidades.map((e) => (
              <button
                key={e.id}
                type="button"
                className="chip"
                aria-pressed={value.especialidades.includes(e.id)}
                onClick={() => alternar(e.id)}
              >
                {e.nombre}
              </button>
            ))}
          </div>
          {errors.especialidades && <small className="field-error">{errors.especialidades}</small>}
        </div>
      )}
    </fieldset>
  );
}
