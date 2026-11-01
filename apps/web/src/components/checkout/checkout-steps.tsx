import { Icon } from '@/components/ui/icon';

const PASOS = ['Carrito', 'Entrega', 'Pago'] as const;

/** Muestra en qué paso de la compra está el cliente. */
export function CheckoutSteps({ actual }: { actual: 0 | 1 | 2 }) {
  return (
    <ol className="pasos" aria-label="Pasos de la compra">
      {PASOS.map((paso, i) => (
        <li
          key={paso}
          className={i < actual ? 'is-hecho' : i === actual ? 'is-actual' : undefined}
          aria-current={i === actual ? 'step' : undefined}
        >
          <span className="pasos-numero">{i < actual ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}</span>
          <span className="pasos-nombre">{paso}</span>
        </li>
      ))}
    </ol>
  );
}
