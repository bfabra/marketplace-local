'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type TableroAdmin } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Icon, type IconName } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EncabezadoAdmin } from '@/components/admin/encabezado';

const numero = (n: number) => n.toLocaleString('es-AR');
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

interface Pendiente {
  cantidad: number;
  texto: string;
  singular?: string;
  icon: IconName;
  href?: string;
}

function pendientes(t: TableroAdmin): Pendiente[] {
  const lista: (Pendiente | false)[] = [
    !!t.tiendas && {
      cantidad: t.tiendas.pendiente,
      texto: 'tiendas esperan aprobación',
      singular: 'tienda espera aprobación',
      icon: 'store',
      href: '/admin/tiendas?estado=pendiente',
    },
    !!t.productos && {
      cantidad: t.productos.enRevision,
      texto: 'productos esperan revisión',
      singular: 'producto espera revisión',
      icon: 'package',
      href: '/admin/productos?vista=revision',
    },
    t.denunciasAbiertas !== undefined && {
      cantidad: t.denunciasAbiertas,
      texto: 'denuncias abiertas',
      singular: 'denuncia abierta',
      icon: 'alert',
    },
    t.reclamosAbiertos !== undefined && {
      cantidad: t.reclamosAbiertos,
      texto: 'reclamos sin resolver',
      singular: 'reclamo sin resolver',
      icon: 'info',
    },
    t.solicitudesPendientes !== undefined && {
      cantidad: t.solicitudesPendientes,
      texto: 'solicitudes de consumidores (arrepentimiento o baja)',
      singular: 'solicitud de un consumidor (arrepentimiento o baja)',
      icon: 'receipt',
    },
    t.reembolsosPendientes !== undefined && {
      cantidad: t.reembolsosPendientes,
      texto: 'reembolsos pendientes',
      singular: 'reembolso pendiente',
      icon: 'card',
      href: '/admin/pedidos?vista=reembolsos',
    },
    !!t.suscripciones && {
      cantidad: t.suscripciones.en_gracia,
      texto: 'suscripciones en período de gracia',
      singular: 'suscripción en período de gracia',
      icon: 'clock',
      href: '/admin/suscripciones?vista=en_gracia',
    },
    !!t.suscripciones && {
      cantidad: t.suscripciones.porVencer,
      texto: 'suscripciones vencen en los próximos 7 días',
      singular: 'suscripción vence en los próximos 7 días',
      icon: 'sparkles',
      href: '/admin/suscripciones?vista=por_vencer',
    },
    !!t.envios && { cantidad: t.envios.fallido, texto: 'envíos fallidos', singular: 'envío fallido', icon: 'truck' },
  ];
  return lista.filter((p): p is Pendiente => !!p && p.cantidad > 0);
}

function Cifra({ valor, label, href }: { valor: string; label: string; href?: string }) {
  const contenido = (
    <>
      <strong>{valor}</strong>
      <span>{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="cifra cifra-link">
      {contenido}
    </Link>
  ) : (
    <div className="cifra">{contenido}</div>
  );
}

function Bloque({ titulo, icon, children }: { titulo: string; icon: IconName; children: React.ReactNode }) {
  return (
    <section className="card admin-bloque">
      <h2>
        <Icon name={icon} size={18} /> {titulo}
      </h2>
      <div className="cifras">{children}</div>
    </section>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [tablero, setTablero] = useState<TableroAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    api<TableroAdmin>('/admin/tablero')
      .then(setTablero)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'))
      .finally(() => setCargando(false));
  }, []);

  useEffect(cargar, [cargar]);

  if (error && !tablero) return <Alert>{error}</Alert>;
  if (!tablero) return <PageSkeleton />;

  const t = tablero;
  const atender = pendientes(t);

  return (
    <div className="stack">
      <EncabezadoAdmin
        destacado
        titulo={user?.nombre ? `Hola, ${user.nombre}` : 'Hola'}
        descripcion="Así está la plataforma hoy."
      >
        <span className="muted">Actualizado a las {hora(t.generadoEn)}</span>
        <button className="btn btn-secondary" onClick={cargar} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </EncabezadoAdmin>

      {error && <Alert>{error}</Alert>}

      <section className="card stack">
        <h2>Para atender</h2>
        {atender.length === 0 ? (
          <p className="muted">
            <Icon name="check" size={16} /> Todo al día: no hay nada pendiente en tus secciones.
          </p>
        ) : (
          <ul className="admin-pendientes">
            {atender.map((p) => {
              const fila = (
                <>
                  <span className="admin-pendiente-icono">
                    <Icon name={p.icon} size={18} />
                  </span>
                  <strong>{numero(p.cantidad)}</strong>
                  <span>{p.cantidad === 1 && p.singular ? p.singular : p.texto}</span>
                  {p.href && <Icon name="chevron-right" size={18} className="admin-pendiente-ir" />}
                </>
              );
              return (
                <li key={p.texto}>
                  {p.href ? (
                    <Link href={p.href} className="admin-pendiente">
                      {fila}
                    </Link>
                  ) : (
                    <div className="admin-pendiente">{fila}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="admin-bloques">
        {t.tiendas && (
          <Bloque titulo="Tiendas" icon="store">
            <Cifra valor={numero(t.tiendas.activa)} label="activas" href="/admin/tiendas?estado=activa" />
            <Cifra valor={numero(t.tiendas.pendiente)} label="pendientes" href="/admin/tiendas?estado=pendiente" />
            <Cifra valor={numero(t.tiendas.suspendida)} label="suspendidas" href="/admin/tiendas?estado=suspendida" />
            <Cifra valor={numero(t.tiendas.vencida)} label="vencidas" href="/admin/tiendas?estado=vencida" />
          </Bloque>
        )}
        {t.productos && (
          <Bloque titulo="Productos" icon="package">
            <Cifra valor={numero(t.productos.publicados)} label="publicados" href="/admin/productos?vista=publicados" />
            <Cifra valor={numero(t.productos.enRevision)} label="en revisión" href="/admin/productos?vista=revision" />
            <Cifra
              valor={numero(t.productos.pausadosModeracion)}
              label="pausados por moderación"
              href="/admin/productos?vista=moderacion"
            />
            <Cifra valor={numero(t.denunciasAbiertas ?? 0)} label="denuncias abiertas" />
          </Bloque>
        )}
        {t.usuarios && (
          <Bloque titulo="Usuarios" icon="users">
            <Cifra valor={numero(t.usuarios.total)} label="cuentas" href="/admin/usuarios" />
            <Cifra valor={numero(t.usuarios.nuevos7dias)} label="nuevas en 7 días" />
            <Cifra valor={numero(t.usuarios.bloqueados)} label="bloqueadas" href="/admin/usuarios?filtro=bloqueados" />
            <Cifra valor={numero(t.reclamosAbiertos ?? 0)} label="reclamos sin resolver" />
          </Bloque>
        )}
        {t.pedidos && (
          <Bloque titulo="Pedidos" icon="receipt">
            <Cifra valor={numero(t.pedidos.hoy)} label="hoy" href="/admin/pedidos?vista=todos" />
            <Cifra valor={numero(t.pedidos.enCurso)} label="en curso (por tienda)" href="/admin/pedidos" />
            <Cifra
              valor={numero(t.pedidos.pendientesPago)}
              label="esperando el pago"
              href="/admin/pedidos?vista=pendiente_pago"
            />
          </Bloque>
        )}
        {t.ventasMes && (
          <Bloque titulo="Ventas del mes" icon="card">
            <Cifra valor={formatPrice(Number(t.ventasMes.monto))} label="en compras pagadas" />
            <Cifra valor={numero(t.ventasMes.pedidos)} label="pedidos pagados" />
            <Cifra
              valor={numero(t.reembolsosPendientes ?? 0)}
              label="reembolsos pendientes"
              href="/admin/pedidos?vista=reembolsos"
            />
          </Bloque>
        )}
        {t.suscripciones && (
          <Bloque titulo="Suscripciones" icon="sparkles">
            <Cifra valor={numero(t.suscripciones.activa)} label="activas" href="/admin/suscripciones?vista=vigentes" />
            <Cifra
              valor={numero(t.suscripciones.porVencer)}
              label="vencen en 7 días"
              href="/admin/suscripciones?vista=por_vencer"
            />
            <Cifra valor={numero(t.suscripciones.en_gracia)} label="en gracia" href="/admin/suscripciones?vista=en_gracia" />
            <Cifra valor={numero(t.suscripciones.pendiente)} label="esperando el pago" />
          </Bloque>
        )}
        {t.envios && (
          <Bloque titulo="Envíos" icon="truck">
            <Cifra valor={numero(t.envios.pendiente)} label="sin asignar" />
            <Cifra valor={numero(t.envios.en_recoleccion)} label="en recolección" />
            <Cifra valor={numero(t.envios.en_camino)} label="en camino" />
            <Cifra valor={numero(t.envios.fallido)} label="fallidos" />
          </Bloque>
        )}
      </div>
    </div>
  );
}
