import app from './app.js';
import { env, appEnv } from './config/env.js';
import { usaStorageRemoto } from './common/utils/images.js';

const server = app.listen(env.PORT, () => {
  console.log(
    `API lista · puerto ${env.PORT} · ${env.NODE_ENV} · perfil ${appEnv} · fotos ${usaStorageRemoto() ? 'Supabase Storage' : 'disco local'}`
  );
});

server.on('error', (err) => {
  console.error('[server] No se pudo escuchar el puerto:', err);
  process.exit(1);
});
