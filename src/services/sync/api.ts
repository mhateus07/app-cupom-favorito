import axios, { Method } from 'axios';
import * as SecureStore from 'expo-secure-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.cupom.impulsiodigital.com';

const CHAVE_REFRESH = 'cupom_favorito_refresh_token';
const MARGEM_MS = 30_000;

export interface TokensApi {
  accessToken: string;
  refreshToken: string;
  expiraEm: string;
}

export class ErroApi extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

const cliente = axios.create({ baseURL: API_URL, timeout: 30_000 });
let acesso: { token: string; expiraEm: number } | null = null;
let renovando: Promise<string> | null = null;

const paraErroApi = (error: unknown): ErroApi => {
  if (axios.isAxiosError(error)) {
    if (!error.response) return new ErroApi(0, 'Sem conexão com o servidor. Tente de novo.');
    const mensagem = (error.response.data as { erro?: string } | undefined)?.erro;
    return new ErroApi(
      error.response.status,
      mensagem ?? 'O servidor não respondeu como esperado.'
    );
  }
  return new ErroApi(0, error instanceof Error ? error.message : 'Erro inesperado.');
};

export const temSessao = async (): Promise<boolean> =>
  (await SecureStore.getItemAsync(CHAVE_REFRESH)) !== null;

export const guardarTokens = async (tokens: TokensApi): Promise<void> => {
  acesso = { token: tokens.accessToken, expiraEm: Date.parse(tokens.expiraEm) };
  await SecureStore.setItemAsync(CHAVE_REFRESH, tokens.refreshToken);
};

export const lerRefreshToken = (): Promise<string | null> =>
  SecureStore.getItemAsync(CHAVE_REFRESH);

export const limparSessao = async (): Promise<void> => {
  acesso = null;
  await SecureStore.deleteItemAsync(CHAVE_REFRESH);
};

const renovar = async (): Promise<string> => {
  const refreshToken = await lerRefreshToken();
  if (!refreshToken) throw new ErroApi(401, 'Entre na sua conta para sincronizar.');
  try {
    const { data } = await cliente.post<TokensApi>('/auth/renovar', { refreshToken });
    await guardarTokens(data);
    return data.accessToken;
  } catch (error) {
    const erro = paraErroApi(error);
    if (erro.status === 401) await limparSessao();
    throw erro;
  }
};

/** Token de acesso válido, renovando quando estiver perto de vencer (uma renovação por vez) */
const tokenAcesso = async (forcarRenovacao = false): Promise<string> => {
  if (!forcarRenovacao && acesso && acesso.expiraEm - MARGEM_MS > Date.now()) return acesso.token;
  renovando ??= renovar().finally(() => {
    renovando = null;
  });
  return renovando;
};

export const chamarPublico = async <T>(
  metodo: Method,
  url: string,
  dados?: unknown
): Promise<T> => {
  try {
    const { data } = await cliente.request<T>({ method: metodo, url, data: dados });
    return data;
  } catch (error) {
    throw paraErroApi(error);
  }
};

export const chamarAutenticado = async <T>(
  metodo: Method,
  url: string,
  dados?: unknown
): Promise<T> => {
  const tentar = async (token: string) =>
    (
      await cliente.request<T>({
        method: metodo,
        url,
        data: dados,
        headers: { Authorization: `Bearer ${token}` },
      })
    ).data;
  try {
    return await tentar(await tokenAcesso());
  } catch (error) {
    // Token recusado (ex.: servidor reiniciado com outro segredo): renova uma vez e tenta de novo
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      try {
        return await tentar(await tokenAcesso(true));
      } catch (segundo) {
        throw segundo instanceof ErroApi ? segundo : paraErroApi(segundo);
      }
    }
    throw error instanceof ErroApi ? error : paraErroApi(error);
  }
};
