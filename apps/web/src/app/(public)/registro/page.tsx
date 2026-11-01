import { Suspense } from 'react';
import { RegisterForm } from '@/components/forms/register-form';

export const metadata = { title: 'Crear cuenta' };

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
