import { Suspense } from 'react';
import { RestablecerForm } from '@/components/forms/restablecer-form';

export const metadata = { title: 'Elegir contraseña nueva', referrer: 'no-referrer' };

export default function RestablecerPage() {
  return (
    <Suspense>
      <RestablecerForm />
    </Suspense>
  );
}
