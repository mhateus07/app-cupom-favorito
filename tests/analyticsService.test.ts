import {
  analisarEstabelecimentos,
  analisarProdutos,
  gerarRecomendacoes,
  gerarResumoGeral,
  produtosComMaiorVariacao,
  resumoDoUltimoMes,
  analisarGastosMensais,
  calcularCestaPorMercado,
} from '../src/services/analytics/analyticsService';
import { CupomData, ItemListaCompra, ProdutoData } from '../src/models/types';

let seq = 0;

const produto = (
  nome: string,
  preco: number,
  quantidade = 1,
  gtin: string | null = null
): ProdutoData => ({
  nome,
  codigo: gtin || String(++seq),
  gtin,
  preco,
  quantidade,
  desconto: 0,
  precoFinal: preco * quantidade,
});

const cupom = (
  cnpj: string,
  nome: string,
  produtos: ProdutoData[],
  data = '2026-10-01'
): CupomData => {
  const total = produtos.reduce((s, p) => s + p.precoFinal, 0);
  return {
    chaveAcesso: String(++seq),
    qrCode: '',
    estabelecimento: { nome, cnpj },
    produtos,
    data,
    subtotal: total,
    descontoTotal: 0,
    total,
    formaPagamento: 'PIX',
  };
};

const ARROZ = '4006381333931';

describe('analisarEstabelecimentos', () => {
  it('compara o mesmo produto, não o valor do carrinho', () => {
    const cupons = [
      // Mercado A: compra grande, mas arroz mais barato
      cupom('A', 'Mercado A', [produto('Arroz', 20, 1, ARROZ), produto('Carne', 200)]),
      // Mercado B: compra pequena, arroz mais caro
      cupom('B', 'Mercado B', [produto('Arroz', 30, 1, ARROZ)]),
    ];

    const [primeiro, segundo] = analisarEstabelecimentos(cupons);

    expect(primeiro.nome).toBe('Mercado A');
    expect(primeiro.indicePreco).toBe(0.8);
    expect(primeiro.produtosComparados).toBe(1);
    // Referência 25; 2 unidades compradas ao todo -> (25 - 20) * 2
    expect(primeiro.economiaEstimada).toBe(10);
    expect(segundo.indicePreco).toBe(1.2);
    expect(segundo.ticketMedio).toBe(30);
  });

  it('marca como não comparável o mercado sem produtos em comum', () => {
    const cupons = [
      cupom('A', 'Mercado A', [produto('Arroz', 20, 1, ARROZ)]),
      cupom('B', 'Mercado B', [produto('Arroz', 30, 1, ARROZ)]),
      cupom('C', 'Mercado C', [produto('Sabão', 5)]),
    ];

    const resultado = analisarEstabelecimentos(cupons);
    expect(resultado[resultado.length - 1]).toMatchObject({ nome: 'Mercado C', indicePreco: null });
  });
});

describe('analisarProdutos', () => {
  it('agrupa sem GTIN pelo nome normalizado, e não por "SEM GTIN"', () => {
    const cupons = [
      cupom('A', 'Mercado A', [produto('Pão Francês', 16), produto('Banana', 7)]),
      cupom('B', 'Mercado B', [produto('PAO FRANCES', 14)]),
    ];

    const pao = analisarProdutos(cupons).find(p => p.chave === 'nome:pao frances')!;
    expect(pao.quantidadeCompras).toBe(2);
    expect(pao.estabelecimentoMaisBarato).toBe('Mercado B');
    expect(analisarProdutos(cupons)).toHaveLength(2);
  });

  it('usa o preço pago com desconto', () => {
    const p = { ...produto('Feijão', 10, 2, ARROZ), desconto: 2, precoFinal: 18 };
    expect(analisarProdutos([cupom('A', 'A', [p])])[0].precoMedio).toBe(9);
  });
});

describe('gerarResumoGeral', () => {
  it('produto mais comprado considera a quantidade', () => {
    const cupons = [
      cupom('A', 'A', [produto('Iogurte', 2, 12), produto('Pão', 1, 1)]),
      cupom('A', 'A', [produto('Pão', 1, 1)]),
    ];
    expect(gerarResumoGeral(cupons).produtoMaisComprado).toBe('Iogurte');
  });
});

describe('gerarRecomendacoes', () => {
  it('não recomenda sem dados comparáveis', () => {
    expect(gerarRecomendacoes([cupom('A', 'A', [produto('Arroz', 20, 1, ARROZ)])])).toEqual([]);
  });

  it('pontua pelo preço relativo', () => {
    const cupons = [
      cupom('A', 'Mercado A', [produto('Arroz', 20, 1, ARROZ)]),
      cupom('B', 'Mercado B', [produto('Arroz', 30, 1, ARROZ)]),
    ];
    const [melhor, pior] = gerarRecomendacoes(cupons);
    expect(melhor).toMatchObject({ estabelecimento: 'Mercado A', score: 90, economiaEstimada: 10 });
    expect(melhor.razoes[0]).toBe('20% mais barato em 1 produto');
    expect(pior).toMatchObject({ score: 10, economiaEstimada: 0 });
  });
});

describe('produtosComMaiorVariacao', () => {
  it('ignora preço mínimo zero (sem divisão por zero)', () => {
    const cupons = [
      cupom('A', 'A', [produto('Brinde', 0, 1, ARROZ)]),
      cupom('B', 'B', [produto('Brinde', 5, 1, ARROZ)]),
    ];
    expect(produtosComMaiorVariacao(cupons)).toEqual([]);
  });
});

describe('resumoDoUltimoMes', () => {
  it('soma só o mês da compra mais recente', () => {
    const cupons = [
      cupom('A', 'A', [produto('Arroz', 20)], '2026-10-14T10:00:00-03:00'),
      cupom('A', 'A', [produto('Arroz', 30)], '2026-10-02T10:00:00-03:00'),
      cupom('A', 'A', [produto('Arroz', 99)], '2026-09-30T10:00:00-03:00'),
    ];
    expect(resumoDoUltimoMes(cupons)).toMatchObject({ quantidade: 2, gasto: 50 });
    expect(resumoDoUltimoMes([])).toBeNull();
  });
});

describe('analisarGastosMensais', () => {
  it('agrega gastos e descontos por mês em ordem decrescente', () => {
    const cupons = [
      cupom('A', 'A', [produto('Arroz', 20)], '2026-09-30'),
      cupom('A', 'A', [produto('Arroz', 30)], '2026-10-02'),
    ];
    expect(analisarGastosMensais(cupons)).toEqual([
      expect.objectContaining({ referencia: '2026-10', gasto: 30, cupons: 1 }),
      expect.objectContaining({ referencia: '2026-09', gasto: 20, cupons: 1 }),
    ]);
  });
});

describe('calcularCestaPorMercado', () => {
  it('estima a cesta pelo menor preço histórico de cada mercado', () => {
    const cupons = [
      cupom('A', 'Mercado A', [produto('Arroz', 20, 1, ARROZ), produto('Feijão', 8)]),
      cupom('B', 'Mercado B', [produto('Arroz', 18, 1, ARROZ), produto('Feijão', 10)]),
    ];
    const itens: ItemListaCompra[] = [
      { id: 1, listaId: 1, nome: 'Arroz', quantidade: 2, comprado: false },
      { id: 2, listaId: 1, nome: 'Feijão', quantidade: 1, comprado: false },
    ];

    expect(calcularCestaPorMercado(itens, cupons)).toMatchObject([
      { estabelecimento: 'Mercado B', totalEstimado: 46, itensEncontrados: 2 },
      { estabelecimento: 'Mercado A', totalEstimado: 48, itensEncontrados: 2, economia: 2 },
    ]);
  });
});
