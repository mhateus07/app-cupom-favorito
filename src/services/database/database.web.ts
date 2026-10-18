import {
  AlertaEnviado,
  AlteracaoSync,
  CupomData,
  EstabelecimentoData,
  FiltroData,
  ListaCompra,
  ProdutoMonitorado,
} from '../../models/types';

const bancoMobile = (): never => {
  throw new Error('O armazenamento local de cupons está disponível apenas no aplicativo mobile.');
};

export const initDatabase = async (): Promise<void> => {};
export const upsertEstabelecimento = async (
  _estabelecimento: EstabelecimentoData
): Promise<number> => bancoMobile();
export const cupomExiste = async (_chaveAcesso: string): Promise<boolean> => bancoMobile();
export const insertCupom = async (_cupomData: CupomData): Promise<number> => bancoMobile();
export const importarCupons = async (
  _cupons: CupomData[]
): Promise<{ importados: number; ignorados: number }> => bancoMobile();
export const getAllCupons = async (): Promise<CupomData[]> => bancoMobile();
export const getCupons = async (_filtros: FiltroData = {}): Promise<CupomData[]> => bancoMobile();
export const getCupomById = async (_id: number): Promise<CupomData | null> => bancoMobile();
export const deleteCupom = async (_id: number): Promise<void> => bancoMobile();
export const atualizarCupom = async (
  _id: number,
  _dados: Pick<CupomData, 'observacao' | 'favorito'>
): Promise<void> => bancoMobile();
export const atualizarCoordenadasEstabelecimento = async (
  _cnpj: string,
  _latitude: number,
  _longitude: number
): Promise<void> => bancoMobile();
export const getListaPadrao = async (): Promise<ListaCompra> => bancoMobile();
export const adicionarItemLista = async (_nome: string, _quantidade = 1): Promise<void> =>
  bancoMobile();
export const marcarItemLista = async (_itemId: number, _comprado: boolean): Promise<void> =>
  bancoMobile();
export const removerItemLista = async (_itemId: number): Promise<void> => bancoMobile();
export const limparItensComprados = async (): Promise<void> => bancoMobile();
export const getPreferencia = async (_chave: string): Promise<string | null> => bancoMobile();
export const setPreferencia = async (_chave: string, _valor: string): Promise<void> =>
  bancoMobile();
export const corrigirNomeProduto = async (_nomeAtual: string, _nomeNovo: string): Promise<void> =>
  bancoMobile();
export const salvarApelidos = async (
  _correcoes: Array<{ original: string; corrigido: string }>
): Promise<void> => bancoMobile();
export const getProdutosMonitorados = async (): Promise<ProdutoMonitorado[]> => bancoMobile();
export const salvarProdutoMonitorado = async (
  _produto: Omit<ProdutoMonitorado, 'id'>
): Promise<void> => bancoMobile();
export const removerProdutoMonitorado = async (_id: number): Promise<void> => bancoMobile();
export const getAlertasEnviados = async (_limite = 100): Promise<AlertaEnviado[]> => bancoMobile();
export const registrarAlertasEnviados = async (
  _alertas: Array<Omit<AlertaEnviado, 'id' | 'enviadoEm'>>
): Promise<void> => bancoMobile();
export const carregarApelidos = async (): Promise<Map<string, string>> => bancoMobile();
export const removerPreferencia = async (_chave: string): Promise<void> => bancoMobile();
export const aoAlterarDados =
  (_ouvinte: () => void): (() => void) =>
  () => {};
export const enfileirarTudo = async (): Promise<void> => bancoMobile();
export const limparFilaSync = async (): Promise<void> => bancoMobile();
export const lerPendentes = async (_limite = 500): Promise<AlteracaoSync[]> => bancoMobile();
export const confirmarEnviados = async (_enviados: AlteracaoSync[]): Promise<void> => bancoMobile();
export const aplicarAlteracoesRemotas = async (_alteracoes: AlteracaoSync[]): Promise<number> =>
  bancoMobile();
