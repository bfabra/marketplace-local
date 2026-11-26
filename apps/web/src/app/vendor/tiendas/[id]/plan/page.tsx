'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type Plan, type PlanesTienda, type Tienda } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { PRODUCT_NAME } from '@/components/layout/logo';
import { Alert } from '@/components/ui/alert';
import { PageSkeleton } from '@/components/ui/skeleton';
import {
  ModalCheckoutPlan,
  precioPlan,
  type ModalCheckoutModo,
} from '@/components/vendor/modal-checkout-plan';

const limiteTxt = (n: number | null, singular: string, plural: string, ilimitado: string) =>
  n === null ? ilimitado : n === 1 ? `1 ${singular}` : `Hasta ${n} ${plural}`;

function etiquetaVencimiento(plan: Tienda['plan']) {
  if (!plan || plan.es_gratis || !plan.fin_periodo) return 'Sin vencimiento (Plan Permanente)';
  const fin = new Date(plan.fin_periodo).getTime();
  const dias = Math.ceil((fin - Date.now()) / (1000 * 60 * 60 * 24));
  return `Vence en ${Math.max(0, dias)} días (Duración: 31 días)`;
}

function colorPrecio(p: Plan, orden: Plan[]) {
  if (p.es_gratis || p.precio_mensual === 0) return 'mp-plan-precio-gratis';
  const pagos = orden.filter((x) => x.precio_mensual > 0);
  const ultimo = pagos[pagos.length - 1];
  return ultimo && p.id === ultimo.id ? 'mp-plan-precio-pro' : 'mp-plan-precio-std';
}

/** CTAs cortos de la maqueta: Gratuito / Estándar / Plan Pro. */
function nombreCta(p: Plan, orden: Plan[]) {
  const pagos = orden.filter((x) => x.precio_mensual > 0);
  const ultimo = pagos[pagos.length - 1];
  if (ultimo && p.id === ultimo.id) {
    return p.nombre.replace(/\s*Ilimitado\s*/i, '').trim() || 'Plan Pro';
  }
  return p.nombre.replace(/^Plan\s+/i, '');
}

function etiquetaCta(p: Plan, orden: Plan[]) {
  const corto = nombreCta(p, orden);
  if (p.es_gratis || p.precio_mensual === 0) return `Cambiar a ${corto}`;
  const pagos = orden.filter((x) => x.precio_mensual > 0);
  const ultimo = pagos[pagos.length - 1];
  if (ultimo && p.id === ultimo.id) return `Pasar a ${corto}`;
  return `Contratar ${corto}`;
}

function beneficioExtra(p: Plan, orden: Plan[]) {
  if (p.es_gratis || p.precio_mensual === 0) return 'Soporte estándar';
  const pagos = orden.filter((x) => x.precio_mensual > 0);
  const ultimo = pagos[pagos.length - 1];
  if (ultimo && p.id === ultimo.id) return 'Atención y soporte prioritario';
  return 'Prioridad en listados';
}

function esPlanTope(p: Plan, orden: Plan[]) {
  const pagos = orden.filter((x) => x.precio_mensual > 0);
  return !!pagos.length && pagos[pagos.length - 1].id === p.id;
}

/** Panel #merchant-panel → Suscripción y Planes (maqueta merchant.js). */
export default function PlanPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [datos, setDatos] = useState<PlanesTienda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalCheckoutModo | null>(null);

  useEffect(() => {
    Promise.all([api<Tienda>(`/stores/${params.id}`), api<PlanesTienda>(`/stores/${params.id}/planes`)])
      .then(([t, p]) => {
        setTienda(t);
        setDatos(p);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  function confirmarBajaLimites(plan: Plan) {
    if (!datos) return true;
    const actual = datos.planes.find((p) => p.id === datos.actual);
    const baja =
      actual &&
      ((plan.max_productos !== null && datos.uso.publicados > plan.max_productos) ||
        (plan.max_empleados !== null && datos.uso.empleados > plan.max_empleados));
    if (!baja) return true;
    return window.confirm(
      `Con el plan ${plan.nombre} se van a pausar los productos publicados más recientes y suspender a los ` +
        'empleados que superen el límite. No se borra nada. ¿Continuar?'
    );
  }

  async function aplicarPlan(plan: Plan, mensaje: string) {
    setOcupado(plan.id);
    setError(null);
    setAviso(null);
    try {
      setTienda(await api<Tienda>(`/stores/${params.id}/plan`, { method: 'POST', body: { plan_id: plan.id } }));
      setDatos(await api<PlanesTienda>(`/stores/${params.id}/planes`));
      setAviso(mensaje);
      setModal(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setOcupado(null);
    }
  }

  function abrirParaPlan(plan: Plan) {
    if (!datos || !tienda) return;
    if (!confirmarBajaLimites(plan)) return;

    const orden = [...datos.planes].sort((a, b) => a.precio_mensual - b.precio_mensual);
    const actual = orden.find((p) => p.id === datos.actual) ?? null;
    const esGratis = plan.es_gratis || plan.precio_mensual === 0;
    if (esGratis) {
      void aplicarPlan(plan, 'Has cambiado de plan correctamente.');
      return;
    }

    // Maqueta: Pro siempre abre prorrateo; Estándar abre checkout.
    if (esPlanTope(plan, orden)) {
      const pagos = orden.filter((p) => p.precio_mensual > 0);
      const base =
        actual && !actual.es_gratis && actual.precio_mensual > 0
          ? actual
          : pagos.find((p) => p.id !== plan.id) ?? plan;
      setModal({
        tipo: 'prorrateo',
        plan,
        planActual: base,
        finPeriodo: tienda.plan?.fin_periodo ?? null,
      });
      return;
    }

    setModal({ tipo: 'checkout', plan });
  }

  function pagar(plan: Plan, metodo: 'mercadopago' | 'transferencia') {
    const mensaje =
      metodo === 'mercadopago'
        ? '¡Pago aprobado mediante Mercado Pago! Suscripción activada por 31 días.'
        : '¡Comprobante registrado! Se ha activado tu suscripción por 31 días.';
    void aplicarPlan(plan, mensaje);
  }

  function cancelarSuscripcion() {
    setModal({ tipo: 'cancelar' });
  }

  function confirmarCancelar() {
    const gratis = datos?.planes.find((p) => p.es_gratis || p.precio_mensual === 0);
    if (!gratis) {
      setError('No hay un plan gratuito disponible para bajar.');
      setModal(null);
      return;
    }
    if (!confirmarBajaLimites(gratis)) return;
    void aplicarPlan(gratis, 'Suscripción y cobro automático cancelados con éxito. Se aplicó el Plan Gratuito.');
  }

  if (error && !datos) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href={`/vendor/tiendas/${params.id}`}>Volver al panel</Link>
      </div>
    );
  }
  if (!tienda || !datos) return <PageSkeleton />;

  const orden = [...datos.planes].sort((a, b) => Number(a.precio_mensual) - Number(b.precio_mensual));
  const planActual = orden.find((p) => p.id === datos.actual) ?? null;
  const esPlanPago = (p: Plan | null | undefined) => !!p && !p.es_gratis && Number(p.precio_mensual) > 0;
  // Maqueta: botón verde solo con plan pago intermedio (Estándar → Pro).
  const upgrade =
    esPlanPago(planActual) ? orden.find((p) => Number(p.precio_mensual) > Number(planActual!.precio_mensual)) : undefined;
  const mostrarRenovacion = datos.esDuenio && (esPlanPago(planActual) || (!!tienda.plan && !tienda.plan.es_gratis));
  const tiendasCount = user?.tiendas.length ?? 1;
  const alDia =
    planActual && (tienda.plan?.estado === 'activa' || tienda.plan?.estado === 'en_gracia' || planActual.es_gratis);

  return (
    <section className="mp-panel mp-suscripcion">
      <div className="mp-suscripcion-cabecera">
        <div>
          <span className="mp-suscripcion-eyebrow">Estado de tu Cuenta</span>
          <h2>Plan Actual: {planActual?.nombre ?? 'Sin plan'}</h2>
          <span className="mp-suscripcion-vence">{etiquetaVencimiento(tienda.plan)}</span>
        </div>
        <div className="mp-suscripcion-acciones">
          {datos.esDuenio && upgrade && (
            <button
              type="button"
              className="mp-btn-upgrade"
              disabled={ocupado !== null}
              onClick={() => abrirParaPlan(upgrade)}
            >
              {ocupado === upgrade.id
                ? 'Cambiando…'
                : `🚀 Pasar a ${nombreCta(upgrade, orden)} (${precioPlan(upgrade.precio_mensual)})`}
            </button>
          )}
          <span className={`mp-suscripcion-badge${alDia ? '' : ' is-warn'}`}>
            {alDia ? 'Activo y al día' : tienda.plan?.estado ?? 'Pendiente'}
          </span>
        </div>
      </div>

      <div className="mp-suscripcion-uso">
        <div>
          <span>Tiendas Registradas</span>
          <strong>
            {tiendasCount}{' '}
            <em>/ {planActual?.es_gratis || planActual?.precio_mensual === 0 ? '1' : 'Ilimitadas'}</em>
          </strong>
        </div>
        <div>
          <span>Productos Publicados</span>
          <strong>
            {datos.uso.publicados}{' '}
            <em>/ {planActual?.max_productos == null ? 'Ilimitados' : planActual.max_productos}</em>
          </strong>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {aviso && <Alert kind="success">{aviso}</Alert>}
      {!datos.esDuenio && <Alert kind="info">Solo el dueño de la tienda puede cambiar el plan.</Alert>}

      <h3 className="mp-suscripcion-titulo-planes">
        Planes Disponibles en {PRODUCT_NAME} San Juan (Vigencia: 31 días)
      </h3>

      <div className="mp-planes-grid">
        {orden.map((p) => {
          const actual = p.id === datos.actual;
          const ctaCls =
            p.es_gratis || p.precio_mensual === 0
              ? 'mp-plan-cta-sec'
              : colorPrecio(p, orden) === 'mp-plan-precio-pro'
                ? 'mp-plan-cta-navy'
                : 'mp-plan-cta-accent';
          return (
            <article key={p.id} className={`mp-plan-card${actual ? ' is-actual' : ''}`}>
              <div>
                <h4>{p.nombre}</h4>
                <p className={`mp-plan-precio ${colorPrecio(p, orden)}`}>
                  {p.precio_mensual > 0 ? (
                    <>
                      {precioPlan(p.precio_mensual)} <span>/ 31 días</span>
                    </>
                  ) : (
                    <>
                      $0 <span>/ permanente</span>
                    </>
                  )}
                </p>
                <ul>
                  <li>
                    {p.es_gratis || p.precio_mensual === 0 ? '1 Tienda en San Juan' : 'Tiendas ilimitadas'}
                  </li>
                  <li>
                    {limiteTxt(p.max_productos, 'producto en total', 'productos en total', 'Carga ilimitada de productos')}
                  </li>
                  <li>{beneficioExtra(p, orden)}</li>
                </ul>
              </div>
              <div>
                {actual ? (
                  <span className="mp-plan-actual-label">Tu Plan Actual</span>
                ) : (
                  datos.esDuenio && (
                    <button
                      type="button"
                      className={ctaCls}
                      disabled={ocupado !== null}
                      onClick={() => abrirParaPlan(p)}
                    >
                      {ocupado === p.id ? 'Cambiando…' : etiquetaCta(p, orden)}
                    </button>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>

      {mostrarRenovacion && (
        <div className="mp-suscripcion-cancelar">
          <div>
            <strong>Gestión de Renovación Automática</strong>
            <span>Podés dar de baja el cobro automático de tu pasarela en cualquier momento.</span>
          </div>
          <button type="button" className="mp-btn-cancelar-plan" disabled={ocupado !== null} onClick={cancelarSuscripcion}>
            Cancelar Suscripción y Cobro Automático
          </button>
        </div>
      )}

      <ModalCheckoutPlan
        modo={modal}
        ocupado={ocupado !== null}
        onCerrar={() => setModal(null)}
        onPagar={pagar}
        onConfirmarCancelar={confirmarCancelar}
      />
    </section>
  );
}
