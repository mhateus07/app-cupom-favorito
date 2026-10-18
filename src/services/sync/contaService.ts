import {
  aplicarAlteracoesRemotas,
  confirmarEnviados,
  enfileirarTudo,
  getPreferencia,
  lerPendentes,
  limparFilaSync,
  removerPreferencia,
  setPreferencia,
} from '../database/database';
import { AlteracaoSync } from '../../models/types';
import {
  chamarAutenticado,
  chamarPublico,
  ErroApi,
  guardarTokens,
  lerRefreshToken,
  limparSessao,
  temSessao,
  TokensApi,
} from './api';
import { executarSincronizacao, RespostaSync } from './executarSincronizacao';

const PREF_EMAIL = 'conta_email';
const PREF_CURSOR = 'sync_cursor';
const PREF_ULTIMA = 'sync_ultima';

export interface EstadoConta {
  conectado: boolean;
  email: string | null;
  sincronizando: boolean;
  ultimaSincronizacao: string | null;
  erro: string | null;
}

let estado: EstadoConta = {
  conectado: false,
  email: null,
  sincronizando: false,
  ultimaSincronizacao: null,
  erro: null,
};
const ouvintes = new Set<(estado: EstadoConta) => void>();

const atualizar = (parcial: Partial<EstadoConta>) => {
  estado = { ...estado, ...parcial };
  ouvintes.forEach(ouvinte => ouvinte(estado));
};

export const getEstadoConta = (): EstadoConta => estado;

export const inscreverConta = (ouvinte: (estado: EstadoConta) => void): (() => void) => {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
};

/** Lê a sessão salva (chamar quando o app abre, depois do banco) */
export const carregarConta = async (): Promise<EstadoConta> => {
  const conectado = await temSessao();
  atualizar({
    conectado,
    email: conectado ? await getPreferencia(PREF_EMAIL) : null,
    ultimaSincronizacao: conectado ? await getPreferencia(PREF_ULTIMA) : null,
  });
  return estado;
};

const iniciarSessao = async (email: string, tokens: TokensApi) => {
  await guardarTokens(tokens);
  await setPreferencia(PREF_EMAIL, email);
  await setPreferencia(PREF_CURSOR, '0');
  // Tudo o que já está neste aparelho vai para a conta
  await enfileirarTudo();
  atualizar({ conectado: true, email, erro: null });
  await sincronizar();
};

export const cadastrar = async (email: string, senha: string): Promise<void> => {
  const resposta = await chamarPublico<TokensApi & { usuario: { email: string } }>(
    'POST',
    '/auth/cadastro',
    { email, senha }
  );
  await iniciarSessao(resposta.usuario.email, resposta);
};

export const entrar = async (email: string, senha: string): Promise<void> => {
  const resposta = await chamarPublico<TokensApi & { usuario: { email: string } }>(
    'POST',
    '/auth/entrar',
    { email, senha }
  );
  await iniciarSessao(resposta.usuario.email, resposta);
};

/** Sai da conta. Os dados continuam neste aparelho. */
export const sair = async (): Promise<void> => {
  const refreshToken = await lerRefreshToken();
  if (refreshToken) {
    await chamarPublico('POST', '/auth/sair', { refreshToken }).catch(() => {});
  }
  await encerrarLocalmente();
};

const encerrarLocalmente = async () => {
  await limparSessao();
  await limparFilaSync();
  await Promise.all([PREF_EMAIL, PREF_CURSOR, PREF_ULTIMA].map(removerPreferencia));
  atualizar({ conectado: false, email: null, ultimaSincronizacao: null, erro: null });
};

export const pedirCodigoSenha = (email: string): Promise<void> =>
  chamarPublico('POST', '/auth/esqueci-senha', { email });

export const redefinirSenha = (email: string, codigo: string, novaSenha: string): Promise<void> =>
  chamarPublico('POST', '/auth/redefinir-senha', { email, codigo, novaSenha });

/** Exclui a conta e os dados no servidor. Os dados deste aparelho continuam nele. */
export const excluirConta = async (senha: string): Promise<void> => {
  await chamarAutenticado('DELETE', '/conta', { senha });
  await encerrarLocalmente();
};

let emAndamento: Promise<void> | null = null;

/** Sincroniza agora (se já houver uma sincronização rodando, espera por ela) */
export const sincronizar = (): Promise<void> => {
  emAndamento ??= (async () => {
    if (!(await temSessao())) return;
    atualizar({ sincronizando: true, erro: null });
    try {
      await executarSincronizacao({
        lerPendentes,
        confirmarEnviados,
        aplicarAlteracoesRemotas,
        lerCursor: async () => Number((await getPreferencia(PREF_CURSOR)) ?? 0),
        salvarCursor: cursor => setPreferencia(PREF_CURSOR, String(cursor)),
        enviar: (desde: number, alteracoes: AlteracaoSync[]) =>
          chamarAutenticado<RespostaSync>('POST', '/sync', { desde, alteracoes }),
      });
      const agora = new Date().toISOString();
      await setPreferencia(PREF_ULTIMA, agora);
      atualizar({ ultimaSincronizacao: agora });
    } catch (error) {
      const erro = error instanceof ErroApi ? error : new ErroApi(0, String(error));
      console.warn('Falha na sincronização:', erro.message);
      // Sessão encerrada no servidor (senha trocada, conta excluída): volta a "sem conta"
      if (erro.status === 401 && !(await temSessao())) {
        await encerrarLocalmente();
      }
      atualizar({ erro: erro.message });
    } finally {
      atualizar({ sincronizando: false });
      emAndamento = null;
    }
  })();
  return emAndamento;
};

let agendada: ReturnType<typeof setTimeout> | null = null;

/** Junta várias alterações seguidas numa sincronização só, alguns segundos depois */
export const agendarSincronizacao = (atrasoMs = 3000): void => {
  if (!estado.conectado) return;
  if (agendada) clearTimeout(agendada);
  agendada = setTimeout(() => {
    agendada = null;
    sincronizar();
  }, atrasoMs);
};
