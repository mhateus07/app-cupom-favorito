export interface Config {
  porta: number;
  databaseUrl: string;
  jwtSecret: string;
  smtpUrl: string | null;
  mailFrom: string;
}

const obrigatoria = (nome: string): string => {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não definida`);
  return valor;
};

export const lerConfig = (): Config => {
  const jwtSecret = obrigatoria('JWT_SECRET');
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET precisa de pelo menos 32 caracteres');
  return {
    porta: Number(process.env.PORT ?? 4200),
    databaseUrl: obrigatoria('DATABASE_URL'),
    jwtSecret,
    smtpUrl: process.env.SMTP_URL || null,
    mailFrom: process.env.MAIL_FROM || 'Cupom Favorito <nao-responda@impulsiodigital.com>',
  };
};
