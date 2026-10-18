import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { construirApp } from '../src/app.js';
import { criarPool, migrar, Pool } from '../src/db.js';

/**
 * Precisa de um Postgres vazio para testes, por exemplo:
 *   docker run -d --name cupom-pg-teste -e POSTGRES_PASSWORD=teste -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL_TESTE=postgres://postgres:teste@127.0.0.1:55432/postgres npm test
 */
const URL_TESTE = process.env.DATABASE_URL_TESTE;

describe.skipIf(!URL_TESTE)('API', () => {
  let pool: Pool;
  let app: FastifyInstance;
  const emails: Array<{ para: string; texto: string }> = [];

  beforeAll(async () => {
    pool = criarPool(URL_TESTE as string);
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrar(pool);
    app = await construirApp(
      {
        porta: 0,
        databaseUrl: URL_TESTE as string,
        jwtSecret: 'segredo-de-teste-com-mais-de-32-caracteres',
        smtpUrl: null,
        mailFrom: 'teste@teste',
      },
      pool,
      async (para, _assunto, texto) => {
        emails.push({ para, texto });
        return true;
      },
      { tentativasAuthPorMinuto: 1000 }
    );
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE usuarios CASCADE');
    emails.length = 0;
  });

  const cadastrar = async (email = 'Ana@Exemplo.com', senha = 'senha-forte-1') => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/auth/cadastro',
      payload: { email, senha },
    });
    return { resposta, corpo: resposta.json() };
  };

  const sync = (token: string, payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/sync',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

  it('limita tentativas de login por minuto', async () => {
    const limitado = await construirApp(
      { porta: 0, databaseUrl: '', jwtSecret: 'x'.repeat(32), smtpUrl: null, mailFrom: '' },
      pool,
      async () => true,
      { tentativasAuthPorMinuto: 2 }
    );
    const entrar = () =>
      limitado.inject({
        method: 'POST',
        url: '/auth/entrar',
        payload: { email: 'x@exemplo.com', senha: 'qualquer-senha' },
      });
    expect((await entrar()).statusCode).toBe(401);
    expect((await entrar()).statusCode).toBe(401);
    expect((await entrar()).statusCode).toBe(429);
    await limitado.close();
  });

  it('migrar é idempotente', async () => {
    expect(await migrar(pool)).toEqual([]);
  });

  it('cadastra com e-mail em minúsculas e recusa duplicado', async () => {
    const { resposta, corpo } = await cadastrar();
    expect(resposta.statusCode).toBe(201);
    expect(corpo.usuario.email).toBe('ana@exemplo.com');
    expect(corpo.accessToken).toBeTruthy();
    expect((await cadastrar('ana@exemplo.com')).resposta.statusCode).toBe(409);
  });

  it('recusa senha curta e e-mail inválido', async () => {
    expect((await cadastrar('ana@exemplo.com', '123')).resposta.statusCode).toBe(400);
    expect((await cadastrar('nao-e-email', 'senha-forte-1')).resposta.statusCode).toBe(400);
  });

  it('entra com a senha certa e recusa a errada', async () => {
    await cadastrar();
    const certa = await app.inject({
      method: 'POST',
      url: '/auth/entrar',
      payload: { email: 'ana@exemplo.com', senha: 'senha-forte-1' },
    });
    expect(certa.statusCode).toBe(200);
    const errada = await app.inject({
      method: 'POST',
      url: '/auth/entrar',
      payload: { email: 'ana@exemplo.com', senha: 'outra-senha' },
    });
    expect(errada.statusCode).toBe(401);
  });

  it('renova a sessão e invalida o refresh token usado', async () => {
    const { corpo } = await cadastrar();
    const renovar = (refreshToken: string) =>
      app.inject({ method: 'POST', url: '/auth/renovar', payload: { refreshToken } });
    const primeira = await renovar(corpo.refreshToken);
    expect(primeira.statusCode).toBe(200);
    expect((await renovar(corpo.refreshToken)).statusCode).toBe(401);
    expect((await renovar(primeira.json().refreshToken)).statusCode).toBe(200);
  });

  it('exige token nas rotas protegidas', async () => {
    expect((await app.inject({ method: 'GET', url: '/conta' })).statusCode).toBe(401);
    const { corpo } = await cadastrar();
    const conta = await app.inject({
      method: 'GET',
      url: '/conta',
      headers: { authorization: `Bearer ${corpo.accessToken}` },
    });
    expect(conta.json().email).toBe('ana@exemplo.com');
  });

  it('redefine a senha com o código enviado por e-mail e encerra as sessões', async () => {
    const { corpo } = await cadastrar();
    const pedido = await app.inject({
      method: 'POST',
      url: '/auth/esqueci-senha',
      payload: { email: 'ana@exemplo.com' },
    });
    expect(pedido.statusCode).toBe(204);
    const codigo = emails[0].texto.match(/\d{6}/)?.[0];
    expect(codigo).toBeTruthy();

    const errado = await app.inject({
      method: 'POST',
      url: '/auth/redefinir-senha',
      payload: { email: 'ana@exemplo.com', codigo: '000000', novaSenha: 'senha-nova-1' },
    });
    expect(errado.statusCode).toBe(400);

    const certo = await app.inject({
      method: 'POST',
      url: '/auth/redefinir-senha',
      payload: { email: 'ana@exemplo.com', codigo, novaSenha: 'senha-nova-1' },
    });
    expect(certo.statusCode).toBe(204);

    const renovar = await app.inject({
      method: 'POST',
      url: '/auth/renovar',
      payload: { refreshToken: corpo.refreshToken },
    });
    expect(renovar.statusCode).toBe(401);
  });

  it('esqueci-senha não revela se o e-mail existe', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/auth/esqueci-senha',
      payload: { email: 'ninguem@exemplo.com' },
    });
    expect(resposta.statusCode).toBe(204);
    expect(emails).toHaveLength(0);
  });

  it('sincroniza entre aparelhos com cursor e marca de exclusão', async () => {
    const { corpo } = await cadastrar();
    const token = corpo.accessToken;
    const cupom = { chaveAcesso: '123', total: 10 };

    const aparelhoA = await sync(token, {
      desde: 0,
      alteracoes: [
        {
          tipo: 'cupom',
          chave: '123',
          dados: cupom,
          excluido: false,
          atualizadoEm: '2026-10-01T10:00:00Z',
        },
      ],
    });
    expect(aparelhoA.statusCode).toBe(200);
    const cursorA = aparelhoA.json().cursor;
    expect(aparelhoA.json().alteracoes).toHaveLength(1);

    // Aparelho B baixa tudo
    const aparelhoB = await sync(token, { desde: 0, alteracoes: [] });
    expect(aparelhoB.json().alteracoes[0]).toMatchObject({
      tipo: 'cupom',
      chave: '123',
      dados: cupom,
    });

    // B exclui; A recebe só a exclusão
    await sync(token, {
      desde: aparelhoB.json().cursor,
      alteracoes: [
        {
          tipo: 'cupom',
          chave: '123',
          dados: null,
          excluido: true,
          atualizadoEm: '2026-10-02T10:00:00Z',
        },
      ],
    });
    const deNovoA = await sync(token, { desde: cursorA, alteracoes: [] });
    expect(deNovoA.json().alteracoes).toEqual([
      expect.objectContaining({ chave: '123', excluido: true, dados: null }),
    ]);
  });

  it('em conflito, vale a alteração mais recente', async () => {
    const { corpo } = await cadastrar();
    const token = corpo.accessToken;
    const item = (nome: string, atualizadoEm: string) => ({
      tipo: 'item_lista',
      chave: 'abc',
      dados: { nome },
      excluido: false,
      atualizadoEm,
    });
    await sync(token, { desde: 0, alteracoes: [item('novo', '2026-10-02T10:00:00Z')] });
    const antigo = await sync(token, {
      desde: 0,
      alteracoes: [item('velho', '2026-10-01T10:00:00Z')],
    });
    expect(antigo.json().alteracoes[0].dados).toEqual({ nome: 'novo' });
  });

  it('não deixa um usuário ver os dados de outro', async () => {
    const ana = (await cadastrar()).corpo.accessToken;
    const bia = (await cadastrar('bia@exemplo.com')).corpo.accessToken;
    await sync(ana, {
      desde: 0,
      alteracoes: [
        {
          tipo: 'apelido',
          chave: 'x',
          dados: { nomeCorrigido: 'X' },
          excluido: false,
          atualizadoEm: '2026-10-01T10:00:00Z',
        },
      ],
    });
    expect((await sync(bia, { desde: 0, alteracoes: [] })).json().alteracoes).toEqual([]);
  });

  it('recusa tipo desconhecido', async () => {
    const { corpo } = await cadastrar();
    const resposta = await sync(corpo.accessToken, {
      desde: 0,
      alteracoes: [
        {
          tipo: 'outro',
          chave: 'x',
          dados: {},
          excluido: false,
          atualizadoEm: '2026-10-01T10:00:00Z',
        },
      ],
    });
    expect(resposta.statusCode).toBe(400);
  });

  it('exclui a conta e os dados com a senha', async () => {
    const { corpo } = await cadastrar();
    const excluir = (senha: string) =>
      app.inject({
        method: 'DELETE',
        url: '/conta',
        headers: { authorization: `Bearer ${corpo.accessToken}` },
        payload: { senha },
      });
    expect((await excluir('errada')).statusCode).toBe(401);
    expect((await excluir('senha-forte-1')).statusCode).toBe(204);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM usuarios');
    expect(rows[0].n).toBe(0);
  });
});
