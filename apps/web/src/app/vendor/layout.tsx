'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { esModoVendedor } from '@/lib/vendedor';
import { PanelVendedor } from '@/components/vendor/panel-vendedor';

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const path = usePathname();
  if (!esModoVendedor(path, user, loading)) return <>{children}</>;
  return <PanelVendedor>{children}</PanelVendedor>;
}
