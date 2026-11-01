import { Suspense } from 'react';
import { RecuperarForm } from '@/components/forms/recuperar-form';

export const metadata = { title: 'Recuperar contraseña' };

export default function RecuperarPage() {
  return (
    <Suspense>
      <RecuperarForm />
    </Suspense>
  );
}
