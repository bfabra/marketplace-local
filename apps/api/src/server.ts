import app from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`Servidor corriendo en el puerto ${env.PORT} en modo ${env.NODE_ENV}`);
});