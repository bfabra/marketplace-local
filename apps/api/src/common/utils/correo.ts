import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

let transporte: Transporter | null = null;

/** Sin SMTP configurado, en desarrollo los correos se muestran en la consola del API. */
export const correoDisponible = () => !!env.SMTP_HOST || env.NODE_ENV !== 'production';

export async function enviarCorreo(correo: Correo) {
  if (!env.SMTP_HOST) {
    if (env.NODE_ENV === 'production') throw new Error('Falta configurar el correo saliente (SMTP_HOST)');
    console.info(`\n[correo de desarrollo] Para: ${correo.para}\nAsunto: ${correo.asunto}\n\n${correo.texto}\n`);
    return;
  }
  transporte ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  await transporte.sendMail({
    from: env.MAIL_FROM ?? env.SMTP_USER,
    to: correo.para,
    subject: correo.asunto,
    text: correo.texto,
    html: correo.html,
  });
}
