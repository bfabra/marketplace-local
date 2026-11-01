import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { AuthProvider } from '@/components/layout/auth-provider';
import { CartProvider } from '@/components/layout/cart-provider';
import { FavoritesProvider } from '@/components/layout/favorites-provider';
import { LocationProvider } from '@/components/layout/location-provider';
import { ToastProvider } from '@/components/ui/toast-provider';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { AppShell } from '@/components/layout/app-shell';
import { BRAND_NAME } from '@/components/layout/logo';
import './globals.css';
import '@/styles/marketplace.css';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: { default: `${BRAND_NAME} · Comprá en los comercios de tu ciudad`, template: `%s · ${BRAND_NAME}` },
  description: 'Los comercios de tu ciudad, en un solo lugar. Envío a domicilio o retiro en el local.',
};

export const viewport: Viewport = {
  themeColor: '#09305f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={manrope.variable}>
      <body>
        <a href="#contenido" className="saltar">
          Saltar al contenido
        </a>
        <AuthProvider>
          <LocationProvider>
            <CartProvider>
              <FavoritesProvider>
                <ToastProvider>
                  <AppShell header={<Header />} footer={<Footer />}>
                    {children}
                  </AppShell>
                </ToastProvider>
              </FavoritesProvider>
            </CartProvider>
          </LocationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
