'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/forms/product-form';

export default function NewProductPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  return (
    <div className="stack">
      <div>
        <Link href={`/vendor/tiendas/${params.id}/productos`} className="muted">
          ← Productos
        </Link>
        <h1>Nuevo producto</h1>
      </div>
      <ProductForm
        tiendaId={params.id}
        onSaved={(producto) => router.replace(`/vendor/tiendas/${params.id}/productos/${producto.id}?creado=1`)}
      />
    </div>
  );
}
