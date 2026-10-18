import {
  calcularInflacaoCesta,
  gerarRecomendacoes,
  historicoPrecoProduto,
  projetarGastoMensal,
} from '../src/services/analytics/analyticsService';
import { CupomData, ProdutoData } from '../src/models/types';

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

const CAFE = '7891000100103';

describe('gerarRecomendacoes com distância', () => {
  const cupons = [
    cupom('A', 'Mercado A', [produto('Café', 20, 1, CAFE)]),
    cupom('B', 'Mercado B', [produto('Café', 21, 1, CAFE)]),
  ];

  it('sem distância, recomenda o mais barato', () => {
    expect(gerarRecomendacoes(cupons)[0].estabelecimento).toBe('Mercado A');
  });

  it('um mercado perto pode passar à frente de um um pouco mais barato e longe', () => {
    const recomendacoes = gerarRecomendacoes(cupons, { A: 20, B: 1.2 });
    expect(recomendacoes[0].estabelecimento).toBe('Mercado B');
    expect(recomendacoes[0].distancia).toBe(1.2);
    expect(recomendacoes[0].razoes).toContain('Perto de você (1,2 km)');
    expect(recomendacoes[1].razoes).toContain('Longe de você (20,0 km)');
  });
});

describe('historicoPrecoProduto', () => {
  const cupons = [
    cupom('B', 'Mercado B', [produto('Café', 22, 1, CAFE)], '2026-09-10'),
    cupom('A', 'Mercado A', [produto('Café Pilão', 20, 2, CAFE)], '2026-08-01'),
    cupom('A', 'Mercado A', [produto('Leite', 5)], '2026-08-02'),
  ];

  it('pela chave junta nomes diferentes do mesmo código de barras, em ordem de data', () => {
    expect(historicoPrecoProduto(`gtin:${CAFE}`, cupons)).toEqual([
      { data: '2026-08-01', preco: 20, estabelecimento: 'Mercado A' },
      { data: '2026-09-10', preco: 22, estabelecimento: 'Mercado B' },
    ]);
  });

  it('pelo nome usa a correspondência exata', () => {
    expect(historicoPrecoProduto('leite', cupons)).toHaveLength(1);
    expect(historicoPrecoProduto('Café', cupons)).toHaveLength(1);
  });
});

describe('projetarGastoMensal', () => {
  it('projeta pelo ritmo do mês e compara com a média dos meses anteriores', () => {
    const cupons = [
      cupom('A', 'A', [produto('X', 300)], '2026-10-05'),
      cupom('A', 'A', [produto('X', 600)], '2026-09-12'),
      cupom('A', 'A', [produto('X', 400)], '2026-08-12'),
    ];
    const projecao = projetarGastoMensal(cupons, new Date(2026, 9, 10)); // 10/10/2026
    expect(projecao.referencia).toBe('2026-10');
    expect(projecao.gastoAteAgora).toBe(300);
    expect(projecao.diasNoMes).toBe(31);
    expect(projecao.projecao).toBe(930);
    expect(projecao.mediaMesesAnteriores).toBe(500);
  });

  it('sem meses anteriores, a média é nula', () => {
    expect(projetarGastoMensal([], new Date(2026, 9, 10)).mediaMesesAnteriores).toBeNull();
  });
});

describe('calcularInflacaoCesta', () => {
  it('compara os mesmos produtos nas quantidades do período anterior', () => {
    const cupons = [
      cupom('A', 'A', [produto('Arroz', 20, 2), produto('Feijão', 10, 1)], '2026-06-15'),
      cupom('A', 'A', [produto('Arroz', 22, 1), produto('Feijão', 10, 1)], '2026-10-01'),
    ];
    // Antes: 2×20 + 10 = 50. Agora, nas mesmas quantidades: 2×22 + 10 = 54 → +8%
    const inflacao = calcularInflacaoCesta(cupons);
    expect(inflacao?.percentual).toBe(8);
    expect(inflacao?.produtosComparados).toBe(2);
    expect(inflacao?.periodoAtual.fim).toBe('2026-10-01');
  });

  it('sem produtos em comum entre os períodos, devolve null', () => {
    const cupons = [
      cupom('A', 'A', [produto('Arroz', 20)], '2026-06-15'),
      cupom('A', 'A', [produto('Feijão', 10)], '2026-10-01'),
    ];
    expect(calcularInflacaoCesta(cupons)).toBeNull();
    expect(calcularInflacaoCesta([])).toBeNull();
  });
});
