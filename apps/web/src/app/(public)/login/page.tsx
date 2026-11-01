import { Suspense } from 'react';
import { LoginForm } from '@/components/forms/login-form';

export const metadata = { title: 'Ingresar' };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
