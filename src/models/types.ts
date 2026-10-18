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
  codigo: string; // Código exibido (GTIN quando existe, senão o código interno da loja)
  gtin?: string | null; // Código de barras válido, usado para comparar entre mercados
  preco: number; // Preço unitário cobrado (antes do desconto)
  quantidade: number;
  desconto: number;
  precoFinal: number; // preco * quantidade - desconto
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
  chave: string; // Identificador usado para agrupar o mesmo produto entre cupons
  nome: string;
  codigo: string;
  precoMedio: number; // Preço unitário médio já com desconto
  precoMinimo: number;
  precoMaximo: number;
  estabelecimentoMaisBarato: string;
  quantidadeCompras: number;
  quantidadeTotal: number;
  ultimaCompra: string;
}

export interface EstabelecimentoEstatistica {
  nome: string;
  cnpj: string;
  ticketMedio: number;
  quantidadeCompras: number;
  descontoMedio: number;
  totalGasto: number;
  ultimaCompra: string;
  /**
   * Preço relativo deste mercado nos produtos que também foram comprados em outros
   * mercados: 1 = na média, 0.9 = 10% mais barato. null quando não há produtos em comum.
   */
  indicePreco: number | null;
  produtosComparados: number;
  /** Quanto as suas compras desses produtos custariam a menos aqui do que na média. */
  economiaEstimada: number;
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
