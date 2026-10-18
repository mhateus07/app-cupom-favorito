import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import argon2 from 'argon2';
import { z } from 'zod';
import { Config } from './config.js';
import { Pool } from './db.js';
import { EnviarEmail } from './email.js';
import { emitirTokens, gerarCodigo, sha256, verificarAcesso } from './tokens.js';

/** Tipos de registro que o app sincroniza */
export const TIPOS = ['cupom', 'item_lista', 'monitorado', 'apelido'] as const;
const LIMITE_ENVIO = 500;
const LIMITE_RECEBIMENTO = 1000;
const TENTATIVAS_CODIGO = 5;

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const senha = z.string().min(8, 'A senha precisa de pelo menos 8 caracteres').max(200);

const credenciais = z.object({ email, senha });
const refresh = z.object({ refreshToken: z.string().min(20).max(200) });
const esqueci = z.object({ email });
const redefinir = z.object({
  email,
  codigo: z.string().regex(/^\d{6}$/),
  novaSenha: senha,
});
const exclusao = z.object({ senha: z.string().min(1).max(200) });
const sincronizacao = z.object({
  desde: z.number().int().min(0),
  alteracoes: z
    .array(
      z.object({
        tipo: z.enum(TIPOS),
        chave: z.string().min(1).max(200),
        dados: z.unknown().nullable(),
        excluido: z.boolean(),
        atualizadoEm: z.iso.datetime({ offset: true }),
      })
    )
    .max(LIMITE_ENVIO),
});

declare module 'fastify' {
  interface FastifyRequest {
    usuarioId: string;
  }
}

class ErroHttp extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

const validar = <T>(schema: z.ZodType<T>, corpo: unknown): T => {
  const resultado = schema.safeParse(corpo);
  if (!resultado.success) {
    throw new ErroHttp(400, resultado.error.issues[0]?.message ?? 'Dados inválidos');
  }
  return resultado.data;
};

// Usado quando o e-mail não existe, para o tempo de resposta não revelar isso
const HASH_FALSO = argon2.hash('senha-que-nao-existe');

export const construirApp = async (
  config: Config,
  pool: Pool,
  enviarEmail: EnviarEmail,
  { tentativasAuthPorMinuto = 10 } = {}
): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024,
  });

  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  const limiteAuth = {
    config: { rateLimit: { max: tentativasAuthPorMinuto, timeWindow: '1 minute' } },
  };

  app.decorateRequest('usuarioId', '');
  const autenticar = async (request: FastifyRequest) => {
    const cabecalho = request.headers.authorization ?? '';
    const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
    const usuarioId = token ? verificarAcesso(token, config.jwtSecret) : null;
    if (!usuarioId) throw new ErroHttp(401, 'Sessão expirada. Entre novamente.');
    request.usuarioId = usuarioId;
  };

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply: FastifyReply) => {
    if (error instanceof ErroHttp) return reply.status(error.status).send({ erro: error.message });
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ erro: error.message });
    }
    request.log.error(error);
    return reply.status(500).send({ erro: 'Erro interno. Tente novamente.' });
  });

  app.get('/saude', async () => {
    await pool.query('SELECT 1');
    return { ok: true };
  });

  // -------------------------------------------------------------------------
  // Conta
  // -------------------------------------------------------------------------

  app.post('/auth/cadastro', limiteAuth, async (request, reply) => {
    const dados = validar(credenciais, request.body);
    const hash = await argon2.hash(dados.senha);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO usuarios (email, senha_hash) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      [dados.email, hash]
    );
    if (!rows[0]) throw new ErroHttp(409, 'Já existe uma conta com este e-mail.');
    const tokens = await emitirTokens(pool, rows[0].id, config.jwtSecret);
    return reply.status(201).send({ ...tokens, usuario: { id: rows[0].id, email: dados.email } });
  });

  app.post('/auth/entrar', limiteAuth, async request => {
    const dados = validar(credenciais, request.body);
    const { rows } = await pool.query<{ id: string; senha_hash: string }>(
      'SELECT id, senha_hash FROM usuarios WHERE email = $1',
      [dados.email]
    );
    const usuario = rows[0];
    const valida = await argon2.verify(usuario?.senha_hash ?? (await HASH_FALSO), dados.senha);
    if (!usuario || !valida) throw new ErroHttp(401, 'E-mail ou senha incorretos.');
    const tokens = await emitirTokens(pool, usuario.id, config.jwtSecret);
    return { ...tokens, usuario: { id: usuario.id, email: dados.email } };
  });

  /** Troca o refresh token por um par novo; o antigo deixa de valer */
  app.post('/auth/renovar', limiteAuth, async request => {
    const { refreshToken } = validar(refresh, request.body);
    const { rows } = await pool.query<{ usuario_id: string }>(
      'DELETE FROM sessoes WHERE token_hash = $1 AND expira_em > now() RETURNING usuario_id',
      [sha256(refreshToken)]
    );
    if (!rows[0]) throw new ErroHttp(401, 'Sessão expirada. Entre novamente.');
    return emitirTokens(pool, rows[0].usuario_id, config.jwtSecret);
  });

  app.post('/auth/sair', async (request, reply) => {
    const { refreshToken } = validar(refresh, request.body);
    await pool.query('DELETE FROM sessoes WHERE token_hash = $1', [sha256(refreshToken)]);
    return reply.status(204).send();
  });

  /** Sempre responde 204, exista ou não a conta, para não revelar e-mails cadastrados */
  app.post('/auth/esqueci-senha', limiteAuth, async (request, reply) => {
    const dados = validar(esqueci, request.body);
    const { rows } = await pool.query<{ id: string }>('SELECT id FROM usuarios WHERE email = $1', [
      dados.email,
    ]);
    if (rows[0]) {
      const codigo = gerarCodigo();
      await pool.query(
        `INSERT INTO codigos_redefinicao (usuario_id, codigo_hash, expira_em)
         VALUES ($1, $2, now() + interval '15 minutes')
         ON CONFLICT (usuario_id) DO UPDATE SET
           codigo_hash = excluded.codigo_hash, expira_em = excluded.expira_em, tentativas = 0`,
        [rows[0].id, sha256(`${rows[0].id}:${codigo}`)]
      );
      await enviarEmail(
        dados.email,
        'Seu código do Cupom Favorito',
        `Seu código para criar uma senha nova é ${codigo}.\n\nEle vale por 15 minutos. Se não foi você que pediu, ignore este e-mail.`
      ).catch(error => request.log.error(error, 'Falha ao enviar e-mail de redefinição'));
    }
    return reply.status(204).send();
  });

  app.post('/auth/redefinir-senha', limiteAuth, async (request, reply) => {
    const dados = validar(redefinir, request.body);
    const invalido = new ErroHttp(400, 'Código inválido ou vencido. Peça um código novo.');
    const { rows } = await pool.query<{ id: string; codigo_hash: string; tentativas: number }>(
      `SELECT u.id, c.codigo_hash, c.tentativas
       FROM usuarios u JOIN codigos_redefinicao c ON c.usuario_id = u.id
       WHERE u.email = $1 AND c.expira_em > now()`,
      [dados.email]
    );
    const registro = rows[0];
    if (!registro || registro.tentativas >= TENTATIVAS_CODIGO) throw invalido;
    if (sha256(`${registro.id}:${dados.codigo}`) !== registro.codigo_hash) {
      await pool.query(
        'UPDATE codigos_redefinicao SET tentativas = tentativas + 1 WHERE usuario_id = $1',
        [registro.id]
      );
      throw invalido;
    }

    const hash = await argon2.hash(dados.novaSenha);
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, registro.id]);
      await cliente.query('DELETE FROM codigos_redefinicao WHERE usuario_id = $1', [registro.id]);
      // Senha nova encerra as sessões abertas em todos os aparelhos
      await cliente.query('DELETE FROM sessoes WHERE usuario_id = $1', [registro.id]);
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
    return reply.status(204).send();
  });

  app.get('/conta', { preHandler: autenticar }, async request => {
    const { rows } = await pool.query<{ id: string; email: string; criado_em: Date }>(
      'SELECT id, email, criado_em FROM usuarios WHERE id = $1',
      [request.usuarioId]
    );
    if (!rows[0]) throw new ErroHttp(401, 'Conta não encontrada.');
    return { id: rows[0].id, email: rows[0].email, criadoEm: rows[0].criado_em.toISOString() };
  });

  /** Exclui a conta e todos os dados sincronizados (pede a senha de novo) */
  app.delete('/conta', { preHandler: autenticar, ...limiteAuth }, async (request, reply) => {
    const dados = validar(exclusao, request.body);
    const { rows } = await pool.query<{ senha_hash: string }>(
      'SELECT senha_hash FROM usuarios WHERE id = $1',
      [request.usuarioId]
    );
    if (!rows[0] || !(await argon2.verify(rows[0].senha_hash, dados.senha))) {
      throw new ErroHttp(401, 'Senha incorreta.');
    }
    await pool.query('DELETE FROM usuarios WHERE id = $1', [request.usuarioId]);
    return reply.status(204).send();
  });

  // -------------------------------------------------------------------------
  // Sincronização
  // -------------------------------------------------------------------------

  /**
   * Recebe as alterações do aparelho e devolve tudo o que mudou depois do cursor dele.
   * Conflitos: vale a gravação mais recente (atualizadoEm), limitada ao horário do
   * servidor para um relógio adiantado não ganhar para sempre.
   */
  app.post('/sync', { preHandler: autenticar }, async request => {
    const dados = validar(sincronizacao, request.body);
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      // Serializa as sincronizações do mesmo usuário: o cursor (seq) fica sempre crescente
      await cliente.query('SELECT pg_advisory_xact_lock(hashtext($1))', [request.usuarioId]);

      for (const alteracao of dados.alteracoes) {
        await cliente.query(
          `INSERT INTO registros (usuario_id, tipo, chave, dados, excluido, atualizado_em)
           VALUES ($1, $2, $3, $4, $5, LEAST($6::timestamptz, now()))
           ON CONFLICT (usuario_id, tipo, chave) DO UPDATE SET
             dados = excluded.dados,
             excluido = excluded.excluido,
             atualizado_em = excluded.atualizado_em,
             seq = nextval('registros_seq')
           WHERE excluded.atualizado_em >= registros.atualizado_em`,
          [
            request.usuarioId,
            alteracao.tipo,
            alteracao.chave,
            alteracao.excluido ? null : JSON.stringify(alteracao.dados ?? null),
            alteracao.excluido,
            alteracao.atualizadoEm,
          ]
        );
      }

      const { rows } = await cliente.query<{
        tipo: string;
        chave: string;
        dados: unknown;
        excluido: boolean;
        atualizado_em: Date;
        seq: string;
      }>(
        `SELECT tipo, chave, dados, excluido, atualizado_em, seq FROM registros
         WHERE usuario_id = $1 AND seq > $2 ORDER BY seq LIMIT $3`,
        [request.usuarioId, dados.desde, LIMITE_RECEBIMENTO]
      );
      await cliente.query('COMMIT');

      return {
        cursor: rows.length ? Number(rows[rows.length - 1].seq) : dados.desde,
        temMais: rows.length === LIMITE_RECEBIMENTO,
        alteracoes: rows.map(row => ({
          tipo: row.tipo,
          chave: row.chave,
          dados: row.dados,
          excluido: row.excluido,
          atualizadoEm: row.atualizado_em.toISOString(),
        })),
      };
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  });

  return app;
};
