import { meanBy } from 'lodash';
import { AlertaEnviado, CupomData, ProdutoData, ProdutoMonitorado } from '../../models/types';
import { chaveProduto } from '../analytics/analyticsService';

/** Queda mínima, em %, para avisar sobre produtos que não estão na lista de monitorados */
export const QUEDA_MINIMA_PADRAO = 5;

export interface AlertaQuedaPreco {
  chave: string;
  produto: string;
  mercado: string;
  cnpj: string;
  /** Preço médio pago antes desta compra (ou o preço-alvo, quando não há histórico) */
  precoReferencia: number;
  precoAtual: number;
  percentual: number;
  motivo: 'queda' | 'alvo';
  precoAlvo?: number;
}

const precoUnitario = (produto: ProdutoData): number =>
  produto.quantidade > 0 ? produto.precoFinal / produto.quantidade : produto.preco;

/**
 * Decide quais produtos do cupom recém-lido merecem aviso:
 * - preço igual ou abaixo do preço-alvo de um produto monitorado; ou
 * - queda em relação ao preço médio já pago maior que a queda mínima (a do produto
 *   monitorado ou a padrão).
 * Não repete aviso do mesmo produto no mesmo mercado por um preço igual ou maior
 * que um já avisado.
 */
export const avaliarAlertas = (
  cupom: CupomData,
  historico: CupomData[],
  monitorados: ProdutoMonitorado[],
  enviados: Array<Pick<AlertaEnviado, 'chave' | 'cnpj' | 'preco'>>
): AlertaQuedaPreco[] => {
  const precosAnteriores = new Map<string, number[]>();
  for (const anterior of historico) {
    if (anterior.chaveAcesso === cupom.chaveAcesso) continue;
    for (const produto of anterior.produtos) {
      const chave = chaveProduto(produto);
      const lista = precosAnteriores.get(chave) ?? [];
      lista.push(precoUnitario(produto));
      precosAnteriores.set(chave, lista);
    }
  }
  const porChave = new Map(monitorados.map(m => [m.chave, m]));
  const { cnpj, nome: mercado } = cupom.estabelecimento;

  // O mesmo produto pode aparecer em mais de uma linha do cupom: vale o menor preço
  const menorPreco = new Map<string, { nome: string; preco: number }>();
  for (const produto of cupom.produtos) {
    const chave = chaveProduto(produto);
    const preco = precoUnitario(produto);
    const atual = menorPreco.get(chave);
    if (!atual || preco < atual.preco) menorPreco.set(chave, { nome: produto.nome, preco });
  }

  const alertas: AlertaQuedaPreco[] = [];
  for (const [chave, { nome, preco }] of menorPreco) {
    if (preco <= 0) continue;
    const monitorado = porChave.get(chave);
    const anteriores = precosAnteriores.get(chave);
    const media = anteriores?.length ? meanBy(anteriores) : null;

    const precoAlvo = monitorado?.precoAlvo ?? null;
    const atingiuAlvo = precoAlvo !== null && preco <= precoAlvo;
    const queda = media ? (1 - preco / media) * 100 : 0;
    const quedaMinima = monitorado?.quedaMinima ?? QUEDA_MINIMA_PADRAO;
    if (!atingiuAlvo && !(media && queda >= quedaMinima)) continue;

    const jaAvisado = enviados.some(
      e => e.chave === chave && e.cnpj === cnpj && e.preco <= preco + 0.005
    );
    if (jaAvisado) continue;

    const referencia = media ?? (precoAlvo as number);
    alertas.push({
      chave,
      produto: monitorado?.nome ?? nome,
      mercado,
      cnpj,
      precoReferencia: Math.round(referencia * 100) / 100,
      precoAtual: Math.round(preco * 100) / 100,
      percentual: Math.max(0, Math.round(queda)),
      motivo: atingiuAlvo ? 'alvo' : 'queda',
      ...(precoAlvo !== null ? { precoAlvo } : {}),
    });
  }
  return alertas;
};
