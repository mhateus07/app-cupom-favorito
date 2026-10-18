import nodemailer from 'nodemailer';
import { Config } from './config.js';

export type EnviarEmail = (para: string, assunto: string, texto: string) => Promise<boolean>;

/** Sem SMTP_URL configurado, não envia e devolve false (a API continua funcionando) */
export const criarEnvioEmail = (config: Config): EnviarEmail => {
  if (!config.smtpUrl) {
    return async para => {
      console.warn(`SMTP_URL não configurado: e-mail para ${para} não foi enviado`);
      return false;
    };
  }
  const transporte = nodemailer.createTransport(config.smtpUrl);
  return async (para, assunto, texto) => {
    await transporte.sendMail({ from: config.mailFrom, to: para, subject: assunto, text: texto });
    return true;
  };
};
