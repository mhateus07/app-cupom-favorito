import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { CupomData } from '../../models/types';

const escaparHtml = (valor: string | number): string =>
  String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const dinheiro = (valor: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

export const gerarRelatorioHtml = (cupons: CupomData[]): string => {
  const total = cupons.reduce((soma, cupom) => soma + cupom.total, 0);
  const descontos = cupons.reduce((soma, cupom) => soma + cupom.descontoTotal, 0);
  const linhas = cupons
    .flatMap(cupom =>
      cupom.produtos.length > 0
        ? cupom.produtos.map(produto => ({
            data: cupom.data,
            mercado: cupom.estabelecimento.nome,
            produto: produto.nome,
            quantidade: produto.quantidade,
            valor: produto.precoFinal,
          }))
        : [
            {
              data: cupom.data,
              mercado: cupom.estabelecimento.nome,
              produto: 'Cupom sem itens detalhados',
              quantidade: 1,
              valor: cupom.total,
            },
          ]
    )
    .map(
      linha => `<tr>
        <td>${escaparHtml(linha.data)}</td>
        <td>${escaparHtml(linha.mercado)}</td>
        <td>${escaparHtml(linha.produto)}</td>
        <td>${escaparHtml(linha.quantidade)}</td>
        <td>${escaparHtml(dinheiro(linha.valor))}</td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
  <html><head><meta charset="utf-8" /><style>
    body { font-family: Arial, sans-serif; color: #0F1412; padding: 28px; }
    h1 { margin: 0 0 4px; font-size: 24px; }
    p { color: #56605A; margin: 4px 0 20px; }
    .resumo { display: flex; gap: 24px; margin-bottom: 24px; }
    .card { border: 1px solid #D9DED9; border-radius: 8px; padding: 12px 16px; }
    .rotulo { color: #56605A; font-size: 11px; text-transform: uppercase; }
    .valor { font-size: 18px; font-weight: bold; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #0F1412; color: white; text-align: left; }
    th, td { padding: 8px; border-bottom: 1px solid #E5E8E5; }
    td:nth-child(4), td:nth-child(5) { text-align: right; }
  </style></head><body>
    <h1>Relatório Cupom Favorito</h1>
    <p>Gerado em ${escaparHtml(new Date().toLocaleString('pt-BR'))}</p>
    <div class="resumo">
      <div class="card"><div class="rotulo">Cupons</div><div class="valor">${cupons.length}</div></div>
      <div class="card"><div class="rotulo">Total gasto</div><div class="valor">${escaparHtml(dinheiro(total))}</div></div>
      <div class="card"><div class="rotulo">Descontos</div><div class="valor">${escaparHtml(dinheiro(descontos))}</div></div>
    </div>
    <table><thead><tr><th>Data</th><th>Mercado</th><th>Produto</th><th>Qtd.</th><th>Valor</th></tr></thead>
    <tbody>${linhas || '<tr><td colspan="5">Nenhum cupom salvo.</td></tr>'}</tbody></table>
  </body></html>`;
};

export const compartilharRelatorioPdf = async (cupons: CupomData[]): Promise<void> => {
  const arquivo = await Print.printToFileAsync({ html: gerarRelatorioHtml(cupons) });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('O compartilhamento de arquivos não está disponível neste dispositivo.');
  }
  await Sharing.shareAsync(arquivo.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Compartilhar relatório PDF',
    UTI: 'com.adobe.pdf',
  });
};
