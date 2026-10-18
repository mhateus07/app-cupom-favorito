import { CupomData, EstabelecimentoData, FiltroData, ListaCompra } from '../../models/types';

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
