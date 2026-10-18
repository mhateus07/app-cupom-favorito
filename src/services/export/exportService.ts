import { CupomData } from '../../models/types';

const escaparCsv = (valor: string | number | boolean | null | undefined): string => {
  const texto = String(valor ?? '');
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/** Exporta uma linha por produto, adequada para abrir no Excel/Sheets. */
export const gerarCsvCupons = (cupons: CupomData[]): string => {
  const cabecalho = [
    'chave_acesso',
    'data',
    'estabelecimento',
    'cnpj',
    'produto',
    'gtin',
    'codigo',
    'unidade',
    'quantidade',
    'preco_unitario',
    'desconto_item',
    'preco_final_item',
    'subtotal_cupom',
    'desconto_total_cupom',
    'total_cupom',
    'forma_pagamento',
  ];

  const linhas = cupons.flatMap(cupom =>
    cupom.produtos.length > 0
      ? cupom.produtos.map(produto =>
          [
            cupom.chaveAcesso,
            cupom.data,
            cupom.estabelecimento.nome,
            cupom.estabelecimento.cnpj,
            produto.nome,
            produto.gtin,
            produto.codigo,
            produto.unidade,
            produto.quantidade,
            produto.preco,
            produto.desconto,
            produto.precoFinal,
            cupom.subtotal,
            cupom.descontoTotal,
            cupom.total,
            cupom.formaPagamento,
          ]
            .map(escaparCsv)
            .join(';')
        )
      : [
          [
            cupom.chaveAcesso,
            cupom.data,
            cupom.estabelecimento.nome,
            cupom.estabelecimento.cnpj,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            cupom.subtotal,
            cupom.descontoTotal,
            cupom.total,
            cupom.formaPagamento,
          ]
            .map(escaparCsv)
            .join(';'),
        ]
  );

  // BOM melhora a abertura de acentos no Excel do Windows.
  return `\uFEFF${cabecalho.map(escaparCsv).join(';')}\n${linhas.join('\n')}`;
};

/** Backup versionado, preservando os dados locais para restauração futura. */
export const gerarBackupJson = (cupons: CupomData[]): string =>
  JSON.stringify(
    {
      schema: 1,
      exportedAt: new Date().toISOString(),
      app: 'cupom-favorito',
      cupons,
    },
    null,
    2
  );

export const lerBackupJson = (conteudo: string): CupomData[] => {
  const dados: unknown = JSON.parse(conteudo);
  if (
    !dados ||
    typeof dados !== 'object' ||
    !Array.isArray((dados as { cupons?: unknown }).cupons)
  ) {
    throw new Error('O arquivo não contém um backup válido do Cupom Favorito.');
  }

  const cupons = (dados as { cupons: unknown[] }).cupons;
  if (
    cupons.some(
      cupom =>
        !cupom ||
        typeof cupom !== 'object' ||
        typeof (cupom as CupomData).chaveAcesso !== 'string' ||
        typeof (cupom as CupomData).estabelecimento?.nome !== 'string' ||
        !Array.isArray((cupom as CupomData).produtos)
    )
  ) {
    throw new Error('O backup contém cupons em um formato incompatível.');
  }
  return cupons as CupomData[];
};
