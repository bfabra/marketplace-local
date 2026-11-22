/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Sin barra final ni sufijo /api: si no, Vercel manda //api/... y Render responde 404.
    const apiUrl = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '').replace(/\/api$/i, '');
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
