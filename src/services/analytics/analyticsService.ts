import {
  CupomData,
  CestaMercado,
  EstabelecimentoEstatistica,
  GastoMensal,
  ProdutoData,
  ProdutoEstatistica,
  ResumoGeral,
  Recomendacao,
  ItemListaCompra,
  InflacaoCesta,
  PontoPreco,
  ProjecaoGasto,
} from '../../models/types';
import { groupBy, meanBy, maxBy, sumBy, orderBy } from 'lodash';
import { format, getDaysInMonth, parseISO, subDays } from 'date-fns';
import { normalizarChaveNome } from '../../utils/texto';

interface ItemComprado extends ProdutoData {
  chave: string;
  precoUnitario: number; // Preço unitário efetivamente pago (com desconto do item)
  estabelecimento: string;
  cnpj: string;
  data: string;
}

const arredondar = (valor: number): number => Math.round(valor * 100) / 100;

/**
 * Identificador do produto para comparação entre cupons e mercados.
 * Usa o código de barras (GTIN) quando existe; o código interno de cada loja não serve
 * para comparar entre mercados, então nesse caso usa o nome normalizado.
 */
export const chaveProduto = (produto: Pick<ProdutoData, 'gtin' | 'nome'>): string =>
  produto.gtin ? `gtin:${produto.gtin}` : `nome:${normalizarChaveNome(produto.nome)}`;

const precoUnitarioPago = (produto: ProdutoData): number =>
  produto.quantidade > 0 ? produto.precoFinal / produto.quantidade : produto.preco;

const listarItens = (cupons: CupomData[]): ItemComprado[] =>
  cupons.flatMap(cupom =>
    cupom.produtos.map(produto => ({
      ...produto,
      chave: chaveProduto(produto),
      precoUnitario: precoUnitarioPago(produto),
      estabelecimento: cupom.estabelecimento.nome,
      cnpj: cupom.estabelecimento.cnpj,
      data: cupom.data,
    }))
  );

/**
 * Analisa produtos e retorna estatísticas por produto
 */
export const analisarProdutos = (cupons: CupomData[]): ProdutoEstatistica[] => {
  const produtosAgrupados = groupBy(listarItens(cupons), 'chave');

  const estatisticas: ProdutoEstatistica[] = Object.entries(produtosAgrupados).map(
    ([chave, itens]) => {
      // Mercado mais barato = menor preço médio pago naquele mercado
      const porMercado = Object.values(groupBy(itens, 'cnpj')).map(doMercado => ({
        nome: doMercado[0].estabelecimento,
        precoMedio: meanBy(doMercado, 'precoUnitario'),
      }));
      const maisBarato = orderBy(porMercado, ['precoMedio'], ['asc'])[0];
      const ultimaCompra = maxBy(itens, 'data');
      const precos = itens.map(i => i.precoUnitario);

      return {
        chave,
        nome: ultimaCompra?.nome || itens[0].nome,
        codigo: itens[0].codigo,
        precoMedio: arredondar(meanBy(itens, 'precoUnitario')),
        precoMinimo: arredondar(Math.min(...precos)),
        precoMaximo: arredondar(Math.max(...precos)),
        estabelecimentoMaisBarato: maisBarato?.nome || '',
        quantidadeCompras: itens.length,
        quantidadeTotal: sumBy(itens, 'quantidade'),
        ultimaCompra: ultimaCompra?.data || '',
      };
    }
  );

  return orderBy(estatisticas, ['quantidadeCompras', 'quantidadeTotal'], ['desc', 'desc']);
};

/**
 * Compara os preços de cada mercado nos produtos que também aparecem em outros mercados.
 * Para cada produto em comum, o preço de referência é a média dos preços médios de cada
 * mercado (assim cada mercado pesa igual, independente de quantas vezes você comprou lá).
 */
const compararMercados = (
  itens: ItemComprado[]
): Map<string, { indicePreco: number | null; produtosComparados: number; economia: number }> => {
  const acumulado = new Map<string, { razoes: number[]; economia: number }>();

  for (const itensDoProduto of Object.values(groupBy(itens, 'chave'))) {
    const porMercado = groupBy(itensDoProduto, 'cnpj');
    const cnpjs = Object.keys(porMercado);
    if (cnpjs.length < 2) continue;

    const precoPorMercado = cnpjs.map(cnpj => ({
      cnpj,
      preco: meanBy(porMercado[cnpj], 'precoUnitario'),
    }));
    const referencia = meanBy(precoPorMercado, 'preco');
    if (referencia <= 0) continue;

    const quantidadeTotal = sumBy(itensDoProduto, 'quantidade');

    for (const { cnpj, preco } of precoPorMercado) {
      const atual = acumulado.get(cnpj) || { razoes: [], economia: 0 };
      atual.razoes.push(preco / referencia);
      atual.economia += (referencia - preco) * quantidadeTotal;
      acumulado.set(cnpj, atual);
    }
  }

  const resultado = new Map<
    string,
    { indicePreco: number | null; produtosComparados: number; economia: number }
  >();
  for (const [cnpj, { razoes, economia }] of acumulado) {
    resultado.set(cnpj, {
      indicePreco: Number((sumBy(razoes) / razoes.length).toFixed(4)),
      produtosComparados: razoes.length,
      economia: arredondar(economia),
    });
  }
  return resultado;
};

/**
 * Analisa estabelecimentos e retorna estatísticas por mercado,
 * do mais barato para o mais caro (mercados sem produtos em comum ficam no fim)
 */
export const analisarEstabelecimentos = (cupons: CupomData[]): EstabelecimentoEstatistica[] => {
  const comparacao = compararMercados(listarItens(cupons));

  const estatisticas: EstabelecimentoEstatistica[] = Object.values(
    groupBy(cupons, 'estabelecimento.cnpj')
  ).map(cuponsDoEstabelecimento => {
    const estabelecimento = cuponsDoEstabelecimento[0].estabelecimento;
    const comparado = comparacao.get(estabelecimento.cnpj);

    return {
      nome: estabelecimento.nome,
      cnpj: estabelecimento.cnpj,
      ticketMedio: arredondar(meanBy(cuponsDoEstabelecimento, 'total')),
      quantidadeCompras: cuponsDoEstabelecimento.length,
      descontoMedio: arredondar(meanBy(cuponsDoEstabelecimento, 'descontoTotal')),
      totalGasto: arredondar(sumBy(cuponsDoEstabelecimento, 'total')),
      ultimaCompra: maxBy(cuponsDoEstabelecimento, 'data')?.data || '',
      indicePreco: comparado?.indicePreco ?? null,
      produtosComparados: comparado?.produtosComparados ?? 0,
      economiaEstimada: comparado?.economia ?? 0,
    };
  });

  return orderBy(
    estatisticas,
    [e => (e.indicePreco === null ? 1 : 0), e => e.indicePreco ?? 0, 'quantidadeCompras'],
    ['asc', 'asc', 'desc']
  );
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

  // Mercado favorito: onde há mais compras (agrupado por CNPJ, não pelo nome)
  const porMercado = Object.values(groupBy(cupons, 'estabelecimento.cnpj'));
  const mercadoFavorito = maxBy(porMercado, lista => lista.length)?.[0].estabelecimento.nome;

  // Produto mais comprado: maior quantidade somada (o mesmo produto tem a mesma unidade)
  const produtoMaisComprado = maxBy(analisarProdutos(cupons), 'quantidadeTotal')?.nome;

  const datasOrdenadas = orderBy(cupons, ['data'], ['asc']);

  return {
    totalCupons: cupons.length,
    totalGasto: arredondar(sumBy(cupons, 'total')),
    economiaComDescontos: arredondar(sumBy(cupons, 'descontoTotal')),
    mercadoFavorito: mercadoFavorito || 'Nenhum',
    produtoMaisComprado: produtoMaisComprado || 'Nenhum',
    periodoAnalise: {
      inicio: datasOrdenadas[0].data,
      fim: datasOrdenadas[datasOrdenadas.length - 1].data,
    },
  };
};

/**
 * Resumo do mês da compra mais recente (card de destaque da tela de cupons)
 */
export const resumoDoUltimoMes = (
  cupons: CupomData[]
): { referencia: string; quantidade: number; gasto: number; economia: number } | null => {
  const maisRecente = maxBy(cupons, 'data');
  if (!maisRecente) return null;

  const mes = maisRecente.data.slice(0, 7); // "2026-10"
  const doMes = cupons.filter(c => c.data.startsWith(mes));

  return {
    referencia: maisRecente.data,
    quantidade: doMes.length,
    gasto: arredondar(sumBy(doMes, 'total')),
    economia: arredondar(sumBy(doMes, 'descontoTotal')),
  };
};

export const analisarGastosMensais = (cupons: CupomData[]): GastoMensal[] => {
  const grupos = groupBy(cupons, cupom => cupom.data.slice(0, 7));
  return orderBy(
    Object.entries(grupos).map(([referencia, lista]) => ({
      referencia,
      gasto: arredondar(sumBy(lista, 'total')),
      economia: arredondar(sumBy(lista, 'descontoTotal')),
      cupons: lista.length,
    })),
    ['referencia'],
    ['desc']
  );
};

/**
 * Compara preços de um produto entre estabelecimentos
 */
export const compararPrecoProduto = (
  produto: string,
  cupons: CupomData[]
): Array<{ estabelecimento: string; preco: number; data: string }> => {
  const termo = normalizarChaveNome(produto);

  const encontrados = listarItens(cupons)
    .filter(item => normalizarChaveNome(item.nome).includes(termo))
    .map(item => ({
      estabelecimento: item.estabelecimento,
      preco: arredondar(item.precoUnitario),
      data: item.data,
    }));

  return orderBy(encontrados, ['preco'], ['asc']);
};

/**
 * Estima o custo da lista em cada mercado usando o menor preço histórico observado
 * para cada item. Itens sem correspondência são contabilizados para não esconder
 * uma cesta incompleta.
 */
export const calcularCestaPorMercado = (
  itens: ItemListaCompra[],
  cupons: CupomData[]
): CestaMercado[] => {
  const pendentes = itens.filter(item => !item.comprado);
  if (pendentes.length === 0) return [];

  const observacoes = listarItens(cupons);
  const mercados = Object.values(groupBy(observacoes, 'cnpj')).map(lista => ({
    nome: lista[0].estabelecimento,
    cnpj: lista[0].cnpj,
  }));

  const resultado = mercados.map(mercado => {
    let totalEstimado = 0;
    let itensEncontrados = 0;
    let itensNaoEncontrados = 0;

    for (const item of pendentes) {
      const termo = normalizarChaveNome(item.nome);
      const encontrados = observacoes.filter(observacao => {
        if (observacao.cnpj !== mercado.cnpj) return false;
        if (item.gtin && observacao.gtin) return item.gtin === observacao.gtin;
        const nome = normalizarChaveNome(observacao.nome);
        return nome.includes(termo) || termo.includes(nome);
      });

      const menorPreco = Math.min(...encontrados.map(observacao => observacao.precoUnitario));
      if (Number.isFinite(menorPreco)) {
        totalEstimado += menorPreco * item.quantidade;
        itensEncontrados++;
      } else {
        itensNaoEncontrados++;
      }
    }

    return {
      estabelecimento: mercado.nome,
      cnpj: mercado.cnpj,
      totalEstimado: arredondar(totalEstimado),
      itensEncontrados,
      itensNaoEncontrados,
    };
  });

  const completos = resultado.filter(item => item.itensEncontrados > 0);
  const menor = Math.min(...completos.map(item => item.totalEstimado));
  return orderBy(
    completos.map(item => ({
      ...item,
      totalEstimado: item.totalEstimado,
      economia: Number.isFinite(menor) ? arredondar(item.totalEstimado - menor) : 0,
    })),
    ['itensNaoEncontrados', 'totalEstimado'],
    ['asc', 'asc']
  ) as CestaMercado[];
};

/**
 * Gera recomendação de onde comprar, considerando só mercados que têm produtos em comum
 * com outros mercados (sem isso não há como saber se um é mais barato que o outro).
 * Com as distâncias (km por CNPJ), mercados perto ganham pontos e os longe perdem.
 */
export const gerarRecomendacoes = (
  cupons: CupomData[],
  distancias: Record<string, number> = {}
): Recomendacao[] => {
  const comparaveis = analisarEstabelecimentos(cupons).filter(
    (e): e is EstabelecimentoEstatistica & { indicePreco: number } => e.indicePreco !== null
  );
  if (comparaveis.length === 0) return [];

  const descontoMedioGeral = meanBy(comparaveis, 'descontoMedio');

  const recomendacoes: Recomendacao[] = comparaveis.map(est => {
    const razoes: string[] = [];
    const diferencaPercentual = Math.round((1 - est.indicePreco) * 100);

    // Cada 1% abaixo da média vale 2 pontos (limitado a ±40)
    let score = 50 + Math.max(-40, Math.min(40, diferencaPercentual * 2));

    const produtos = `${est.produtosComparados} ${est.produtosComparados === 1 ? 'produto' : 'produtos'}`;
    if (diferencaPercentual > 0) {
      razoes.push(`${diferencaPercentual}% mais barato em ${produtos}`);
    } else if (diferencaPercentual < 0) {
      razoes.push(`${-diferencaPercentual}% mais caro em ${produtos}`);
    } else {
      razoes.push(`Preços na média em ${produtos}`);
    }

    if (est.descontoMedio > 0 && est.descontoMedio > descontoMedioGeral) {
      razoes.push('Oferece bons descontos');
      score += 5;
    }

    if (est.quantidadeCompras > 5) {
      razoes.push('Estabelecimento frequente');
      score += 5;
    }

    const distancia = distancias[est.cnpj];
    if (distancia !== undefined) {
      const km = `${distancia.toFixed(1).replace('.', ',')} km`;
      if (distancia <= 2) {
        razoes.push(`Perto de você (${km})`);
        score += 10;
      } else if (distancia <= 5) {
        razoes.push(`A ${km} de você`);
        score += 5;
      } else if (distancia > 15) {
        razoes.push(`Longe de você (${km})`);
        score -= 10;
      }
    }

    return {
      estabelecimento: est.nome,
      score: Math.max(0, Math.min(100, Math.round(score))),
      razoes,
      economiaEstimada: Math.max(0, est.economiaEstimada),
      distancia,
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
  const comVariacao = analisarProdutos(cupons)
    .filter(p => p.precoMinimo > 0)
    .map(p => ({
      nome: p.nome,
      variacaoPercentual: arredondar(((p.precoMaximo - p.precoMinimo) / p.precoMinimo) * 100),
      precoMin: p.precoMinimo,
      precoMax: p.precoMaximo,
    }))
    .filter(p => p.variacaoPercentual > 5); // Apenas variações maiores que 5%

  return orderBy(comVariacao, ['variacaoPercentual'], ['desc']);
};

/**
 * Preços pagos por um produto ao longo do tempo (um ponto por compra), do mais antigo
 * para o mais recente. Aceita a chave de agrupamento ou o nome do produto.
 */
export const historicoPrecoProduto = (produto: string, cupons: CupomData[]): PontoPreco[] => {
  const porChave = produto.startsWith('gtin:') || produto.startsWith('nome:');
  const alvo = porChave ? produto : normalizarChaveNome(produto);
  // Pelo nome, entram também os produtos com GTIN que tenham exatamente esse nome
  const encontrados = listarItens(cupons).filter(item =>
    porChave ? item.chave === alvo : normalizarChaveNome(item.nome) === alvo
  );

  return orderBy(
    encontrados.map(item => ({
      data: item.data,
      preco: arredondar(item.precoUnitario),
      estabelecimento: item.estabelecimento,
    })),
    ['data'],
    ['asc']
  );
};

/**
 * Projeta o gasto do mês atual pelo ritmo de compras até hoje e compara com a média
 * dos três meses anteriores que tiveram compras
 */
export const projetarGastoMensal = (cupons: CupomData[], hoje = new Date()): ProjecaoGasto => {
  const referencia = format(hoje, 'yyyy-MM');
  const doMes = cupons.filter(cupom => cupom.data.startsWith(referencia));
  const gastoAteAgora = arredondar(sumBy(doMes, 'total'));
  const diasNoMes = getDaysInMonth(hoje);
  const diasDecorridos = hoje.getDate();

  const anteriores = analisarGastosMensais(cupons)
    .filter(mes => mes.referencia < referencia)
    .slice(0, 3);

  return {
    referencia,
    gastoAteAgora,
    projecao: arredondar((gastoAteAgora / diasDecorridos) * diasNoMes),
    mediaMesesAnteriores: anteriores.length ? arredondar(meanBy(anteriores, 'gasto')) : null,
    diasDecorridos,
    diasNoMes,
  };
};

/**
 * Inflação da cesta pessoal: quanto custariam hoje os produtos que você comprou no período
 * anterior, nas mesmas quantidades (índice de Laspeyres). Os períodos têm o mesmo tamanho
 * e terminam na compra mais recente. Devolve null sem produtos comprados nos dois períodos.
 */
export const calcularInflacaoCesta = (cupons: CupomData[], dias = 90): InflacaoCesta | null => {
  const maisRecente = maxBy(cupons, 'data');
  if (!maisRecente) return null;

  const fim = parseISO(maisRecente.data.slice(0, 10));
  const inicioAtual = format(subDays(fim, dias - 1), 'yyyy-MM-dd');
  const inicioAnterior = format(subDays(fim, dias * 2 - 1), 'yyyy-MM-dd');
  const fimAnterior = format(subDays(fim, dias), 'yyyy-MM-dd');
  const fimAtual = format(fim, 'yyyy-MM-dd');

  const itens = listarItens(cupons);
  const noPeriodo = (inicio: string, final: string) =>
    groupBy(
      itens.filter(item => {
        const dia = item.data.slice(0, 10);
        return dia >= inicio && dia <= final;
      }),
      'chave'
    );
  const atual = noPeriodo(inicioAtual, fimAtual);
  const anterior = noPeriodo(inicioAnterior, fimAnterior);

  let custoAnterior = 0;
  let custoAtual = 0;
  let produtosComparados = 0;
  for (const [chave, compras] of Object.entries(anterior)) {
    const agora = atual[chave];
    if (!agora) continue;
    const quantidade = sumBy(compras, 'quantidade') || compras.length;
    custoAnterior += meanBy(compras, 'precoUnitario') * quantidade;
    custoAtual += meanBy(agora, 'precoUnitario') * quantidade;
    produtosComparados++;
  }

  if (produtosComparados === 0 || custoAnterior <= 0) return null;

  return {
    percentual: arredondar((custoAtual / custoAnterior - 1) * 100),
    produtosComparados,
    periodoAtual: { inicio: inicioAtual, fim: fimAtual },
    periodoAnterior: { inicio: inicioAnterior, fim: fimAnterior },
  };
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
 * Formata quantidade no padrão brasileiro (0,5 / 1,235 / 2)
 */
export const formatarQuantidade = (quantidade: number): string => {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(quantidade);
};

/**
 * Formata CNPJ (00.000.000/0000-00); devolve o valor original se não tiver 14 dígitos
 */
export const formatarCNPJ = (cnpj: string): string => {
  const digitos = cnpj.replace(/\D/g, '');
  if (digitos.length !== 14) return cnpj;
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
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
