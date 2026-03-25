// Tipos de dados do aplicativo

export interface EstabelecimentoData {
  id?: number;
  nome: string;
  cnpj: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
}

export interface ProdutoData {
  id?: number;
  nome: string;
  codigo: string;
  preco: number;
  quantidade: number;
  desconto: number;
  precoFinal: number;
  cupomId?: number;
}

export interface CupomData {
  id?: number;
  chaveAcesso: string;
  qrCode: string;
  estabelecimento: EstabelecimentoData;
  produtos: ProdutoData[];
  data: string;
  subtotal: number;
  descontoTotal: number;
  total: number;
  formaPagamento: string;
}

// Tipos para análises e estatísticas

export interface ProdutoEstatistica {
  nome: string;
  codigo: string;
  precoMedio: number;
  precoMinimo: number;
  precoMaximo: number;
  estabelecimentoMaisBarato: string;
  quantidadeCompras: number;
  ultimaCompra: string;
}

export interface EstabelecimentoEstatistica {
  nome: string;
  cnpj: string;
  precoMedioTotal: number;
  quantidadeCompras: number;
  descontoMedio: number;
  totalGasto: number;
  ultimaCompra: string;
}

export interface ResumoGeral {
  totalCupons: number;
  totalGasto: number;
  economiaComDescontos: number;
  mercadoFavorito: string;
  produtoMaisComprado: string;
  periodoAnalise: {
    inicio: string;
    fim: string;
  };
}

export interface Recomendacao {
  estabelecimento: string;
  score: number; // 0-100
  razoes: string[];
  economiaEstimada: number;
  distancia?: number; // em km, opcional
}

// Tipos para filtros e buscas

export interface FiltroData {
  estabelecimento?: string;
  dataInicio?: string;
  dataFim?: string;
  precoMinimo?: number;
  precoMaximo?: number;
}

export interface ProdutoBusca {
  termo: string;
  filtro?: FiltroData;
}
