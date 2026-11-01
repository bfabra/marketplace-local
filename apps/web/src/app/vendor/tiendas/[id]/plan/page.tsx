'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type Plan, type PlanesTienda, type Tienda } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { BarraUso, EncabezadoPanel } from '@/components/vendor/panel-tienda';

const limite = (n: number | null, unidad: string) =>
  n === null ? `${unidad[0].toUpperCase()}${unidad.slice(1)} ilimitados` : `Hasta ${n} ${unidad}`;

export default function PlanPage({ params }: { params: { id: string } }) {
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
    if (plan.precio_mensual > 0 && !window.confirm(`El plan ${plan.nombre} cuesta ${formatPrice(plan.precio_mensual)} por mes. En desarrollo el pago con Mercado Pago se simula aprobado. ¿Continuar?`)) {
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

  if (error && !datos) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href={`/vendor/tiendas/${params.id}`}>Volver al panel</Link>
      </div>
    );
  }
  if (!tienda || !datos) return <PageSkeleton />;

  const planActual = datos.planes.find((p) => p.id === datos.actual);

  return (
    <section className="mp-panel">
      <EncabezadoPanel
        tienda={tienda}
        titulo="Plan de la tienda"
        icono="sparkles"
        descripcion="Elegí el plan que mejor acompaña el crecimiento de tu comercio."
      />

      <section className="mp-uso-plan" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div>
          <p className="mp-uso-texto">
            <strong>{datos.uso.publicados}</strong> de {planActual?.max_productos ?? 'ilimitados'} productos publicados
          </p>
          <BarraUso usado={datos.uso.publicados} maximo={planActual?.max_productos ?? null} label="Productos publicados" />
        </div>
        <div>
          {planActual?.max_empleados === 0 ? (
            <p className="mp-uso-texto">Tu plan actual no incluye empleados.</p>
          ) : (
            <>
              <p className="mp-uso-texto">
                <strong>{datos.uso.empleados}</strong> de {planActual?.max_empleados ?? 'ilimitados'} empleados
              </p>
              <BarraUso usado={datos.uso.empleados} maximo={planActual?.max_empleados ?? null} label="Empleados" />
            </>
          )}
        </div>
      </section>

      {error && <Alert>{error}</Alert>}
      {aviso && <Alert kind="success">{aviso}</Alert>}
      {!datos.esDuenio && <Alert kind="info">Solo el dueño de la tienda puede cambiar el plan.</Alert>}

      <section className="pt-planes">
        {datos.planes.map((p) => {
          const actual = p.id === datos.actual;
          return (
            <div key={p.id} className={`card pt-plan${actual ? ' pt-plan-actual' : ''}`}>
              {actual && <span className="pt-plan-cinta">Tu plan actual</span>}
              <h2>{p.nombre}</h2>
              <p className="pt-plan-precio">
                {p.precio_mensual > 0 ? (
                  <>
                    <strong>{formatPrice(p.precio_mensual)}</strong> <span>/ mes</span>
                  </>
                ) : (
                  <>
                    <strong>Gratis</strong> <span>sin costo mensual</span>
                  </>
                )}
              </p>
              <ul className="pt-plan-beneficios">
                <li>
                  <Icon name="package" size={18} /> {limite(p.max_productos, 'productos publicados')}
                </li>
                <li className={p.max_empleados === 0 ? 'pt-plan-no' : undefined}>
                  <Icon name="users" size={18} /> {p.max_empleados === 0 ? 'Sin empleados' : limite(p.max_empleados, 'empleados')}
                </li>
                <li>
                  <Icon name="card" size={18} /> Cobros con Mercado Pago
                </li>
              </ul>
              <div className="pt-al-pie">
                {actual ? (
                  <span className="btn btn-block pt-plan-elegido">
                    <Icon name="shield" size={18} /> Plan vigente
                  </span>
                ) : (
                  datos.esDuenio && (
                    <button
                      className={`btn btn-block${p.precio_mensual > (planActual?.precio_mensual ?? 0) ? ' btn-accent' : ' btn-secondary'}`}
                      disabled={ocupado !== null}
                      onClick={() => elegir(p)}
                    >
                      {ocupado === p.id ? 'Cambiando…' : `Elegir ${p.nombre}`}
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </section>
    </section>
  );
}
