// Tipos de dados do aplicativo

export interface EstabelecimentoData {
  id?: number;
  nome: string;
  cnpj: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  latitude?: number;
  longitude?: number;
}

export interface ProdutoData {
  id?: number;
  nome: string;
  codigo: string; // Código exibido (GTIN quando existe, senão o código interno da loja)
  gtin?: string | null; // Código de barras válido, usado para comparar entre mercados
  unidade?: string; // UN, KG, L etc., quando informado pela NFC-e
  marca?: string;
  categoria?: string;
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
  observacao?: string;
  favorito?: boolean;
  dataImportacao?: string;
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
  distancia?: number;
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

export interface GastoMensal {
  referencia: string;
  gasto: number;
  economia: number;
  cupons: number;
}

export interface Recomendacao {
  estabelecimento: string;
  score: number; // 0-100
  razoes: string[];
  economiaEstimada: number;
  distancia?: number; // em km, opcional
}

export interface ProdutoMonitorado {
  id: number;
  chave: string; // Mesma chave de agrupamento das análises (GTIN ou nome normalizado)
  nome: string;
  precoAlvo: number | null; // Avisa quando o preço pago ficar igual ou abaixo deste valor
  quedaMinima: number; // Percentual mínimo de queda em relação à média para avisar
}

export interface AlertaEnviado {
  id: number;
  chave: string;
  produto: string;
  mercado: string;
  cnpj: string;
  preco: number;
  precoReferencia: number;
  enviadoEm: string;
}

export interface PontoPreco {
  data: string;
  preco: number;
  estabelecimento: string;
}

export interface ProjecaoGasto {
  referencia: string; // "2026-10"
  gastoAteAgora: number;
  projecao: number;
  mediaMesesAnteriores: number | null;
  diasDecorridos: number;
  diasNoMes: number;
}

export interface InflacaoCesta {
  percentual: number; // 3.2 = cesta 3,2% mais cara que no período anterior
  produtosComparados: number;
  periodoAtual: { inicio: string; fim: string };
  periodoAnterior: { inicio: string; fim: string };
}

// Tipos para filtros e buscas

export interface FiltroData {
  termo?: string;
  estabelecimento?: string;
  dataInicio?: string;
  dataFim?: string;
  precoMinimo?: number;
  precoMaximo?: number;
  limite?: number;
  offset?: number;
  ordem?: 'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc';
}

export interface ProdutoBusca {
  termo: string;
  filtro?: FiltroData;
}

export interface ItemListaCompra {
  id: number;
  listaId: number;
  nome: string;
  quantidade: number;
  comprado: boolean;
  gtin?: string | null;
}

export interface ListaCompra {
  id: number;
  nome: string;
  itens: ItemListaCompra[];
}

export interface CestaMercado {
  estabelecimento: string;
  cnpj: string;
  totalEstimado: number;
  itensEncontrados: number;
  itensNaoEncontrados: number;
  distancia?: number;
  economia?: number;
}

// Sincronização com a conta

export type TipoSync = 'cupom' | 'item_lista' | 'monitorado' | 'apelido';

export interface AlteracaoSync {
  tipo: TipoSync;
  chave: string;
  dados: unknown;
  excluido: boolean;
  atualizadoEm: string;
}
