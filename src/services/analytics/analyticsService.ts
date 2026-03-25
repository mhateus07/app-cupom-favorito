import {
  CupomData,
  EstabelecimentoEstatistica,
  ProdutoEstatistica,
  ResumoGeral,
  Recomendacao,
} from '../../models/types';
import { groupBy, meanBy, minBy, maxBy, sumBy, orderBy } from 'lodash';
import { format, parseISO } from 'date-fns';

/**
 * Analisa produtos e retorna estatísticas por produto
 */
export const analisarProdutos = (cupons: CupomData[]): ProdutoEstatistica[] => {
  // Flatten todos os produtos de todos os cupons
  const todosProdutos = cupons.flatMap(cupom =>
    cupom.produtos.map(produto => ({
      ...produto,
      estabelecimento: cupom.estabelecimento.nome,
      data: cupom.data,
    }))
  );

  // Agrupar por código do produto
  const produtosAgrupados = groupBy(todosProdutos, 'codigo');

  const estatisticas: ProdutoEstatistica[] = Object.entries(produtosAgrupados).map(
    ([codigo, produtos]) => {
      const precoMedio = meanBy(produtos, 'preco');
      const produtoMaisBarato = minBy(produtos, 'preco');
      const produtoMaisCaro = maxBy(produtos, 'preco');
      const ultimaCompra = maxBy(produtos, 'data');

      return {
        nome: produtos[0].nome,
        codigo,
        precoMedio: Number(precoMedio.toFixed(2)),
        precoMinimo: produtoMaisBarato?.preco || 0,
        precoMaximo: produtoMaisCaro?.preco || 0,
        estabelecimentoMaisBarato: produtoMaisBarato?.estabelecimento || '',
        quantidadeCompras: produtos.length,
        ultimaCompra: ultimaCompra?.data || '',
      };
    }
  );

  return orderBy(estatisticas, ['quantidadeCompras'], ['desc']);
};

/**
 * Analisa estabelecimentos e retorna estatísticas por mercado
 */
export const analisarEstabelecimentos = (
  cupons: CupomData[]
): EstabelecimentoEstatistica[] => {
  const cuponsAgrupados = groupBy(cupons, 'estabelecimento.cnpj');

  const estatisticas: EstabelecimentoEstatistica[] = Object.values(cuponsAgrupados).map(
    cuponsDoEstabelecimento => {
      const estabelecimento = cuponsDoEstabelecimento[0].estabelecimento;
      const totalGasto = sumBy(cuponsDoEstabelecimento, 'total');
      const totalDescontos = sumBy(cuponsDoEstabelecimento, 'descontoTotal');
      const precoMedio = meanBy(cuponsDoEstabelecimento, 'total');
      const ultimoCupom = maxBy(cuponsDoEstabelecimento, 'data');

      return {
        nome: estabelecimento.nome,
        cnpj: estabelecimento.cnpj,
        precoMedioTotal: Number(precoMedio.toFixed(2)),
        quantidadeCompras: cuponsDoEstabelecimento.length,
        descontoMedio: Number((totalDescontos / cuponsDoEstabelecimento.length).toFixed(2)),
        totalGasto: Number(totalGasto.toFixed(2)),
        ultimaCompra: ultimoCupom?.data || '',
      };
    }
  );

  return orderBy(estatisticas, ['precoMedioTotal'], ['asc']);
};

/**
 * Gera resumo geral das compras
 */
export const gerarResumoGeral = (cupons: CupomData[]): ResumoGeral => {
  if (cupons.length === 0) {
    return {
      totalCupons: 0,
      totalGasto: 0,
      economiaComDescontos: 0,
      mercadoFavorito: 'Nenhum',
      produtoMaisComprado: 'Nenhum',
      periodoAnalise: {
        inicio: '',
        fim: '',
      },
    };
  }

  const totalGasto = sumBy(cupons, 'total');
  const economiaComDescontos = sumBy(cupons, 'descontoTotal');

  // Mercado favorito (mais compras)
  const estabelecimentosCount = groupBy(cupons, 'estabelecimento.nome');
  const mercadoFavorito = maxBy(
    Object.entries(estabelecimentosCount),
    ([, cupons]) => cupons.length
  );

  // Produto mais comprado
  const todosProdutos = cupons.flatMap(c => c.produtos);
  const produtosCount = groupBy(todosProdutos, 'nome');
  const produtoMaisComprado = maxBy(
    Object.entries(produtosCount),
    ([, produtos]) => produtos.length
  );

  // Período de análise
  const datasOrdenadas = orderBy(cupons, ['data'], ['asc']);
  const inicio = datasOrdenadas[0]?.data || '';
  const fim = datasOrdenadas[datasOrdenadas.length - 1]?.data || '';

  return {
    totalCupons: cupons.length,
    totalGasto: Number(totalGasto.toFixed(2)),
    economiaComDescontos: Number(economiaComDescontos.toFixed(2)),
    mercadoFavorito: mercadoFavorito?.[0] || 'Nenhum',
    produtoMaisComprado: produtoMaisComprado?.[0] || 'Nenhum',
    periodoAnalise: {
      inicio,
      fim,
    },
  };
};

/**
 * Compara preços de um produto entre estabelecimentos
 */
export const compararPrecoProduto = (
  produto: string,
  cupons: CupomData[]
): Array<{ estabelecimento: string; preco: number; data: string }> => {
  const todosProdutos = cupons.flatMap(cupom =>
    cupom.produtos
      .filter(p => p.nome.toLowerCase().includes(produto.toLowerCase()))
      .map(p => ({
        estabelecimento: cupom.estabelecimento.nome,
        preco: p.preco,
        data: cupom.data,
      }))
  );

  return orderBy(todosProdutos, ['preco'], ['asc']);
};

/**
 * Gera recomendação de onde comprar
 */
export const gerarRecomendacoes = (cupons: CupomData[]): Recomendacao[] => {
  if (cupons.length === 0) return [];

  const estatisticasEstabelecimentos = analisarEstabelecimentos(cupons);

  const recomendacoes: Recomendacao[] = estatisticasEstabelecimentos.map(est => {
    const razoes: string[] = [];
    let score = 50; // Base score

    // Analisa preço médio (quanto menor, melhor)
    const precoMedioDeTodos = meanBy(estatisticasEstabelecimentos, 'precoMedioTotal');
    if (est.precoMedioTotal < precoMedioDeTodos) {
      razoes.push('Preços abaixo da média');
      score += 20;
    }

    // Analisa descontos
    const descontoMedioDeTodos = meanBy(estatisticasEstabelecimentos, 'descontoMedio');
    if (est.descontoMedio > descontoMedioDeTodos) {
      razoes.push('Oferece bons descontos');
      score += 15;
    }

    // Frequência de compras
    if (est.quantidadeCompras > 5) {
      razoes.push('Estabelecimento frequente');
      score += 10;
    }

    // Economia estimada
    const economiaEstimada = Number(
      ((precoMedioDeTodos - est.precoMedioTotal) * 10).toFixed(2)
    );

    return {
      estabelecimento: est.nome,
      score: Math.min(score, 100),
      razoes,
      economiaEstimada: economiaEstimada > 0 ? economiaEstimada : 0,
    };
  });

  return orderBy(recomendacoes, ['score'], ['desc']);
};

/**
 * Identifica produtos com maior variação de preço
 */
export const produtosComMaiorVariacao = (
  cupons: CupomData[]
): Array<{ nome: string; variacaoPercentual: number; precoMin: number; precoMax: number }> => {
  const estatisticasProdutos = analisarProdutos(cupons);

  const comVariacao = estatisticasProdutos
    .map(p => {
      const variacao = p.precoMaximo - p.precoMinimo;
      const variacaoPercentual = (variacao / p.precoMinimo) * 100;

      return {
        nome: p.nome,
        variacaoPercentual: Number(variacaoPercentual.toFixed(2)),
        precoMin: p.precoMinimo,
        precoMax: p.precoMaximo,
      };
    })
    .filter(p => p.variacaoPercentual > 5); // Apenas variações maiores que 5%

  return orderBy(comVariacao, ['variacaoPercentual'], ['desc']);
};

/**
 * Formata valor monetário
 */
export const formatarMoeda = (valor: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
};

/**
 * Formata data
 */
export const formatarData = (data: string): string => {
  try {
    return format(parseISO(data), 'dd/MM/yyyy');
  } catch {
    return data;
  }
};
