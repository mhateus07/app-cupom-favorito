import { createHash, randomBytes, randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Pool } from './db.js';

export const DURACAO_ACESSO_SEGUNDOS = 15 * 60;
const DURACAO_SESSAO_DIAS = 90;

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Validade do accessToken, em ISO 8601 */
  expiraEm: string;
}

export const sha256 = (valor: string): string => createHash('sha256').update(valor).digest('hex');

export const gerarCodigo = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const assinarAcesso = (usuarioId: string, segredo: string): string =>
  jwt.sign({}, segredo, {
    algorithm: 'HS256',
    subject: usuarioId,
    expiresIn: DURACAO_ACESSO_SEGUNDOS,
  });

/** Devolve o id do usuário, ou null se o token for inválido ou estiver vencido */
export const verificarAcesso = (token: string, segredo: string): string | null => {
  try {
    const conteudo = jwt.verify(token, segredo, { algorithms: ['HS256'] });
    return typeof conteudo === 'object' && typeof conteudo.sub === 'string' ? conteudo.sub : null;
  } catch {
    return null;
  }
};

/** Cria uma sessão nova (refresh token opaco, guardado só como hash) */
export const emitirTokens = async (
  pool: Pool,
  usuarioId: string,
  segredo: string
): Promise<Tokens> => {
  const refreshToken = randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO sessoes (usuario_id, token_hash, expira_em)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [usuarioId, sha256(refreshToken), DURACAO_SESSAO_DIAS]
  );
  return {
    accessToken: assinarAcesso(usuarioId, segredo),
    refreshToken,
    expiraEm: new Date(Date.now() + DURACAO_ACESSO_SEGUNDOS * 1000).toISOString(),
  };
};
