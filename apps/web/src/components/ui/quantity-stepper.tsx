import { Icon } from './icon';

export function QuantityStepper({
  valor,
  min = 1,
  max,
  disabled = false,
  onChange,
  etiqueta = 'Cantidad',
  size = 'md',
}: {
  valor: number;
  min?: number;
  max: number;
  disabled?: boolean;
  onChange: (n: number) => void;
  etiqueta?: string;
  size?: 'sm' | 'md';
}) {
  const ajustar = (n: number) => onChange(Math.max(min, Math.min(max, n)));
  return (
    <div className={`stepper stepper-${size}`} role="group" aria-label={etiqueta}>
      <button type="button" aria-label="Restar uno" disabled={disabled || valor <= min} onClick={() => ajustar(valor - 1)}>
        <Icon name="minus" size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={etiqueta}
        min={min}
        max={max}
        value={valor}
        disabled={disabled}
        onChange={(e) => ajustar(Number(e.target.value) || min)}
      />
      <button type="button" aria-label="Sumar uno" disabled={disabled || valor >= max} onClick={() => ajustar(valor + 1)}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}
