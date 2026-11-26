'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Plan } from '@/lib/api-client';

export type ModalCheckoutModo =
  | { tipo: 'checkout'; plan: Plan }
  | { tipo: 'prorrateo'; plan: Plan; planActual: Plan; finPeriodo: string | null }
  | { tipo: 'cancelar' };

/** Precio como en la maqueta: $10.000 */
export function precioPlan(n: number) {
  return `$${n.toLocaleString('es-AR')}`;
}

function diasRestantes(finPeriodo: string | null) {
  if (!finPeriodo) return 15;
  return Math.max(0, Math.ceil((new Date(finPeriodo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function desgloseProrrateo(plan: Plan, planActual: Plan, finPeriodo: string | null) {
  const dias = diasRestantes(finPeriodo);
  const saldo = Math.round((planActual.precio_mensual / 31) * dias);
  const bruto = plan.precio_mensual - saldo;
  const total = bruto > 0 ? bruto : Math.min(5000, plan.precio_mensual);
  return { dias, saldo, total };
}

/**
 * #checkout-payment-modal (merchant.js): contratación, prorrateo y cancelación.
 * Overlay fixed a pantalla completa, igual que la maqueta.
 */
export function ModalCheckoutPlan({
  modo,
  ocupado,
  onCerrar,
  onPagar,
  onConfirmarCancelar,
}: {
  modo: ModalCheckoutModo | null;
  ocupado: boolean;
  onCerrar: () => void;
  onPagar: (plan: Plan, metodo: 'mercadopago' | 'transferencia') => void;
  onConfirmarCancelar: () => void;
}) {
  const [nodo, setNodo] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setNodo(document.body);
  }, []);

  if (!modo || !nodo) return null;

  const titulo =
    modo.tipo === 'checkout'
      ? `Contratación de ${modo.plan.nombre} (${precioPlan(modo.plan.precio_mensual)} / 31 días)`
      : modo.tipo === 'prorrateo'
        ? `Mejora de Plan con Prorrateo (${modo.plan.nombre})`
        : 'Cancelar Suscripción y Cobro Automático';

  const prorrateo =
    modo.tipo === 'prorrateo' ? desgloseProrrateo(modo.plan, modo.planActual, modo.finPeriodo) : null;

  return createPortal(
    <div className="mp-checkout-overlay" role="presentation">
      <div
        className="mp-checkout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mp-checkout-plan-titulo"
      >
        <div className="mp-checkout-cabecera">
          <h3 id="mp-checkout-plan-titulo">{titulo}</h3>
          <button type="button" className="mp-checkout-cerrar" aria-label="Cerrar" onClick={onCerrar} disabled={ocupado}>
            ×
          </button>
        </div>

        <div className="mp-checkout-cuerpo">
          {modo.tipo === 'checkout' && (
            <>
              <div className="mp-checkout-plan-intro">
                <strong>Seleccioná tu método de pago:</strong>
                <p>
                  Tu plan se activará automáticamente por el plazo de <strong>31 días corridos</strong>.
                </p>
              </div>
              <div className="mp-checkout-plan-metodos">
                <button
                  type="button"
                  className="mp-checkout-btn-mp"
                  disabled={ocupado}
                  onClick={() => onPagar(modo.plan, 'mercadopago')}
                >
                  <span className="mp-checkout-btn-label">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                      <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
                    </svg>
                    Pagar con Mercado Pago (API Oficial)
                  </span>
                  <span>{ocupado ? 'Procesando…' : precioPlan(modo.plan.precio_mensual)}</span>
                </button>
                <button
                  type="button"
                  className="mp-checkout-btn-cbu"
                  disabled={ocupado}
                  onClick={() => onPagar(modo.plan, 'transferencia')}
                >
                  <span className="mp-checkout-btn-label">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    Transferencia Bancaria / CBU
                  </span>
                  <span>{ocupado ? 'Procesando…' : precioPlan(modo.plan.precio_mensual)}</span>
                </button>
              </div>
              <button type="button" className="mp-checkout-btn-sec" disabled={ocupado} onClick={onCerrar}>
                Cancelar
              </button>
            </>
          )}

          {modo.tipo === 'prorrateo' && prorrateo && (
            <>
              <div className="mp-checkout-prorrateo-aviso">
                <strong>Desglose de Prorrateo Automático:</strong>
                <p>
                  Como te quedan <strong>{prorrateo.dias} días</strong> de tu plan actual, hoy abonarás solo la
                  diferencia proporcional descontando el saldo a favor.
                </p>
              </div>
              <div className="mp-checkout-prorrateo-tabla">
                <div>
                  <span>Precio {modo.plan.nombre.includes('Pro') ? 'Plan Pro' : modo.plan.nombre}:</span>
                  <strong>{precioPlan(modo.plan.precio_mensual)}</strong>
                </div>
                <div className="is-saldo">
                  <span>Saldo a favor ({prorrateo.dias} días):</span>
                  <strong>-{precioPlan(prorrateo.saldo)}</strong>
                </div>
                <hr />
                <div className="is-total">
                  <span>Total a abonar hoy:</span>
                  <span className="mp-checkout-total">{precioPlan(prorrateo.total)}</span>
                </div>
              </div>
              <div className="mp-checkout-plan-metodos">
                <button
                  type="button"
                  className="mp-checkout-btn-mp is-simple"
                  disabled={ocupado}
                  onClick={() => onPagar(modo.plan, 'mercadopago')}
                >
                  {ocupado ? 'Procesando…' : `Confirmar y Pagar Diferencia (${precioPlan(prorrateo.total)})`}
                </button>
                <button type="button" className="mp-checkout-btn-sec" disabled={ocupado} onClick={onCerrar}>
                  Cancelar
                </button>
              </div>
            </>
          )}

          {modo.tipo === 'cancelar' && (
            <>
              <div className="mp-checkout-cancelar-aviso">
                <strong>Aviso importante:</strong> Al dar de baja la suscripción, se desactivarán los cobros
                automáticos recurrentes en tu tarjeta o pasarela. Tu plan actual se mantendrá activo hasta la fecha
                de su vencimiento.
              </div>
              <p className="mp-checkout-cancelar-pregunta">¿Confirmás que querés dar de baja el cobro automático?</p>
              <div className="mp-checkout-cancelar-acciones">
                <button type="button" className="mp-checkout-btn-danger" disabled={ocupado} onClick={onConfirmarCancelar}>
                  {ocupado ? 'Cancelando…' : 'Sí, Cancelar Cobro Automático'}
                </button>
                <button type="button" className="mp-checkout-btn-sec" disabled={ocupado} onClick={onCerrar}>
                  Volver
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    nodo
  );
}
