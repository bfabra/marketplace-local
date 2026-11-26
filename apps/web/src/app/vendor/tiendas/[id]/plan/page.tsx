'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type Plan, type PlanesTienda, type Tienda } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/utils';
import { PRODUCT_NAME } from '@/components/layout/logo';
import { Alert } from '@/components/ui/alert';
import { PageSkeleton } from '@/components/ui/skeleton';

const limiteTxt = (n: number | null, singular: string, plural: string, ilimitado: string) =>
  n === null ? ilimitado : n === 1 ? `1 ${singular}` : `Hasta ${n} ${plural}`;

function etiquetaVencimiento(plan: Tienda['plan']) {
  if (!plan || plan.es_gratis || !plan.fin_periodo) return 'Sin vencimiento (plan permanente)';
  const fin = new Date(plan.fin_periodo).getTime();
  const dias = Math.ceil((fin - Date.now()) / (1000 * 60 * 60 * 24));
  return `Vence en ${Math.max(0, dias)} días (vigencia mensual)`;
}

function colorPrecio(p: Plan, orden: Plan[]) {
  if (p.es_gratis || p.precio_mensual === 0) return 'mp-plan-precio-gratis';
  const pagos = orden.filter((x) => x.precio_mensual > 0);
  const ultimo = pagos[pagos.length - 1];
  return ultimo && p.id === ultimo.id ? 'mp-plan-precio-pro' : 'mp-plan-precio-std';
}

function etiquetaCta(p: Plan, orden: Plan[]) {
  if (p.es_gratis || p.precio_mensual === 0) return `Cambiar a ${p.nombre}`;
  const pagos = orden.filter((x) => x.precio_mensual > 0);
  const ultimo = pagos[pagos.length - 1];
  if (ultimo && p.id === ultimo.id) return `Pasar a ${p.nombre}`;
  return `Contratar ${p.nombre}`;
}

/** Panel #merchant-panel → Suscripción y Planes (maqueta merchant.js). */
export default function PlanPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [datos, setDatos] = useState<PlanesTienda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Tienda>(`/stores/${params.id}`), api<PlanesTienda>(`/stores/${params.id}/planes`)])
      .then(([t, p]) => {
        setTienda(t);
        setDatos(p);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  async function elegir(plan: Plan) {
    if (!datos) return;
    const actual = datos.planes.find((p) => p.id === datos.actual);
    const baja =
      actual &&
      ((plan.max_productos !== null && datos.uso.publicados > plan.max_productos) ||
        (plan.max_empleados !== null && datos.uso.empleados > plan.max_empleados));
    if (
      baja &&
      !window.confirm(
        `Con el plan ${plan.nombre} se van a pausar los productos publicados más recientes y suspender a los ` +
          'empleados que superen el límite. No se borra nada. ¿Continuar?'
      )
    ) {
      return;
    }
    if (
      plan.precio_mensual > 0 &&
      !window.confirm(
        `El plan ${plan.nombre} cuesta ${formatPrice(plan.precio_mensual)} por mes. En desarrollo el pago con Mercado Pago se simula aprobado. ¿Continuar?`
      )
    ) {
      return;
    }

    setOcupado(plan.id);
    setError(null);
    setAviso(null);
    try {
      setTienda(await api<Tienda>(`/stores/${params.id}/plan`, { method: 'POST', body: { plan_id: plan.id } }));
      setDatos(await api<PlanesTienda>(`/stores/${params.id}/planes`));
      setAviso(`Listo: tu tienda tiene el plan ${plan.nombre}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setOcupado(null);
    }
  }

  function cancelarSuscripcion() {
    const gratis = datos?.planes.find((p) => p.es_gratis || p.precio_mensual === 0);
    if (!gratis) {
      setError('No hay un plan gratuito disponible para bajar.');
      return;
    }
    if (
      !window.confirm(
        '¿Cancelar la suscripción y el cobro automático? Tu tienda pasará al plan gratuito.'
      )
    ) {
      return;
    }
    void elegir(gratis);
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

  const orden = [...datos.planes].sort((a, b) => a.precio_mensual - b.precio_mensual);
  const planActual = orden.find((p) => p.id === datos.actual) ?? null;
  const upgrade = orden.find((p) => planActual && p.precio_mensual > planActual.precio_mensual);
  const tiendasCount = user?.tiendas.length ?? 1;
  const alDia = planActual && (tienda.plan?.estado === 'activa' || tienda.plan?.estado === 'en_gracia' || planActual.es_gratis);

  return (
    <section className="mp-panel mp-suscripcion">
      <div className="mp-suscripcion-cabecera">
        <div>
          <span className="mp-suscripcion-eyebrow">Estado de tu cuenta</span>
          <h2>Plan actual: {planActual?.nombre ?? 'Sin plan'}</h2>
          <span className="mp-suscripcion-vence">{etiquetaVencimiento(tienda.plan)}</span>
        </div>
        <div className="mp-suscripcion-acciones">
          {datos.esDuenio && upgrade && (
            <button
              type="button"
              className="mp-btn-upgrade"
              disabled={ocupado !== null}
              onClick={() => elegir(upgrade)}
            >
              {ocupado === upgrade.id ? 'Cambiando…' : `Pasar a ${upgrade.nombre} (${formatPrice(upgrade.precio_mensual)})`}
            </button>
          )}
          <span className={`mp-suscripcion-badge${alDia ? '' : ' is-warn'}`}>
            {alDia ? 'Activo y al día' : tienda.plan?.estado ?? 'Pendiente'}
          </span>
        </div>
      </div>

      <div className="mp-suscripcion-uso">
        <div>
          <span>Tiendas registradas</span>
          <strong>
            {tiendasCount}{' '}
            <em>/ {planActual?.es_gratis ? '1' : 'Ilimitadas'}</em>
          </strong>
        </div>
        <div>
          <span>Productos publicados</span>
          <strong>
            {datos.uso.publicados}{' '}
            <em>/ {planActual?.max_productos == null ? 'Ilimitados' : planActual.max_productos}</em>
          </strong>
        </div>
        <div>
          <span>Empleados activos</span>
          <strong>
            {datos.uso.empleados}{' '}
            <em>
              /{' '}
              {planActual?.max_empleados == null
                ? 'Ilimitados'
                : planActual.max_empleados === 0
                  ? 'Sin cupo'
                  : planActual.max_empleados}
            </em>
          </strong>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {aviso && <Alert kind="success">{aviso}</Alert>}
      {!datos.esDuenio && <Alert kind="info">Solo el dueño de la tienda puede cambiar el plan.</Alert>}

      <h3 className="mp-suscripcion-titulo-planes">
        Planes disponibles en {PRODUCT_NAME} (vigencia mensual)
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
                      {formatPrice(p.precio_mensual)} <span>/ mes</span>
                    </>
                  ) : (
                    <>
                      $0 <span>/ permanente</span>
                    </>
                  )}
                </p>
                <ul>
                  <li>
                    {p.es_gratis || p.precio_mensual === 0
                      ? '1 tienda en San Juan'
                      : 'Tiendas ilimitadas'}
                  </li>
                  <li>{limiteTxt(p.max_productos, 'producto publicado', 'productos publicados', 'Carga ilimitada de productos')}</li>
                  <li>
                    {p.max_empleados === 0
                      ? 'Sin empleados'
                      : limiteTxt(p.max_empleados, 'empleado', 'empleados', 'Empleados ilimitados')}
                  </li>
                  <li>{p.precio_mensual > 0 ? 'Prioridad en listados y soporte' : 'Soporte estándar'}</li>
                </ul>
              </div>
              <div>
                {actual ? (
                  <span className="mp-plan-actual-label">Tu plan actual</span>
                ) : (
                  datos.esDuenio && (
                    <button
                      type="button"
                      className={ctaCls}
                      disabled={ocupado !== null}
                      onClick={() => elegir(p)}
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

      {planActual && !planActual.es_gratis && planActual.precio_mensual > 0 && datos.esDuenio && (
        <div className="mp-suscripcion-cancelar">
          <div>
            <strong>Gestión de renovación automática</strong>
            <span>Podés dar de baja el cobro automático de tu pasarela en cualquier momento.</span>
          </div>
          <button type="button" className="mp-btn-cancelar-plan" disabled={ocupado !== null} onClick={cancelarSuscripcion}>
            Cancelar suscripción y cobro automático
          </button>
        </div>
      )}
    </section>
  );
}
