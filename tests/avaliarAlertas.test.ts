import { avaliarAlertas } from '../src/services/notifications/avaliarAlertas';
import { chaveProduto } from '../src/services/analytics/analyticsService';
import { CupomData, ProdutoData, ProdutoMonitorado } from '../src/models/types';

let seq = 0;

const produto = (nome: string, preco: number, quantidade = 1): ProdutoData => ({
  nome,
  codigo: String(++seq),
  gtin: null,
  preco,
  quantidade,
  desconto: 0,
  precoFinal: preco * quantidade,
});

const cupom = (cnpj: string, produtos: ProdutoData[]): CupomData => ({
  chaveAcesso: String(++seq),
  qrCode: '',
  estabelecimento: { nome: `Mercado ${cnpj}`, cnpj },
  produtos,
  data: '2026-10-01',
  subtotal: 0,
  descontoTotal: 0,
  total: 0,
  formaPagamento: 'PIX',
});

const monitorado = (nome: string, extra: Partial<ProdutoMonitorado> = {}): ProdutoMonitorado => ({
  id: ++seq,
  chave: chaveProduto({ nome, gtin: null }),
  nome,
  precoAlvo: null,
  quedaMinima: 5,
  ...extra,
});

const historico = [cupom('A', [produto('Café', 20)]), cupom('B', [produto('Café', 24)])];

describe('avaliarAlertas', () => {
  it('avisa quando o preço cai mais que a queda mínima padrão em relação à média', () => {
    const alertas = avaliarAlertas(cupom('C', [produto('Café', 19.8)]), historico, [], []);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      produto: 'Café',
      cnpj: 'C',
      precoReferencia: 22,
      precoAtual: 19.8,
      percentual: 10,
      motivo: 'queda',
    });
  });

  it('não avisa quedas pequenas nem produtos sem histórico', () => {
    const novo = cupom('C', [produto('Café', 21.5), produto('Leite', 3)]);
    expect(avaliarAlertas(novo, historico, [], [])).toEqual([]);
  });

  it('usa a queda mínima do produto monitorado', () => {
    const novo = cupom('C', [produto('Café', 19.8)]);
    expect(avaliarAlertas(novo, historico, [monitorado('Café', { quedaMinima: 15 })], [])).toEqual(
      []
    );
  });

  it('avisa quando atinge o preço-alvo, mesmo sem histórico', () => {
    const novo = cupom('C', [produto('Leite', 4.5)]);
    const alertas = avaliarAlertas(novo, [], [monitorado('Leite', { precoAlvo: 4.99 })], []);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ motivo: 'alvo', precoAlvo: 4.99, precoReferencia: 4.99 });
  });

  it('não repete aviso do mesmo produto e mercado por preço igual ou maior', () => {
    const novo = cupom('C', [produto('Café', 19.8)]);
    const enviados = [{ chave: 'nome:cafe', cnpj: 'C', preco: 19.8 }];
    expect(avaliarAlertas(novo, historico, [], enviados)).toEqual([]);
    // Em outro mercado, ou por um preço menor, avisa de novo
    expect(
      avaliarAlertas(cupom('D', [produto('Café', 19.8)]), historico, [], enviados)
    ).toHaveLength(1);
    expect(avaliarAlertas(cupom('C', [produto('Café', 18)]), historico, [], enviados)).toHaveLength(
      1
    );
  });

  it('considera o menor preço quando o produto aparece em mais de uma linha', () => {
    const novo = cupom('C', [produto('Café', 21), produto('Café', 18)]);
    const alertas = avaliarAlertas(novo, historico, [], []);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].precoAtual).toBe(18);
  });
});
