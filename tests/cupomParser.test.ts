import {
  convertNFCeDataToCupomData,
  extrairDadosNFCe,
  isChaveAcessoValida,
  normalizeProdutoNome,
  parseQRCode,
} from '../src/services/parser/cupomParser';
import { gtinValido, parseValorBR } from '../src/services/sefaz/nfceExtractor';
import { CNPJ_COM_ZERO, htmlNFCe, montarChave, xmlNFCe } from './fixtures/nfce';

describe('parseQRCode', () => {
  const chave = montarChave(CNPJ_COM_ZERO);

  it('extrai a chave do parâmetro p do QR Code', () => {
    const url = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${chave}|2|1|1|ABCDEF`;
    expect(parseQRCode(url)).toEqual({ chaveAcesso: chave, url, isValid: true });
  });

  it('rejeita chave com dígito verificador errado', () => {
    const errada = chave.slice(0, 43) + ((Number(chave[43]) + 1) % 10);
    expect(isChaveAcessoValida(errada)).toBe(false);
    expect(parseQRCode(`https://x/qrcode?p=${errada}|2|1`).isValid).toBe(false);
  });

  it('rejeita QR Codes que não são de cupom', () => {
    expect(parseQRCode('https://example.com').isValid).toBe(false);
  });
});

describe('extração do XML', () => {
  const chave = montarChave(CNPJ_COM_ZERO);
  const nfce = extrairDadosNFCe({ xmlContent: xmlNFCe(chave) })!;
  const cupom = convertNFCeDataToCupomData(nfce, chave, 'https://x');

  it('mantém zeros à esquerda do CNPJ', () => {
    expect(cupom.estabelecimento.cnpj).toBe(CNPJ_COM_ZERO);
  });

  it('desconta o desconto do item no preço final', () => {
    expect(cupom.produtos[0].precoFinal).toBe(16.5);
  });

  it('não trata "SEM GTIN" como código de barras', () => {
    expect(cupom.produtos[0].gtin).toBe('4006381333931');
    expect(cupom.produtos[1].gtin).toBeNull();
    expect(cupom.produtos[1].codigo).toBe('000456');
  });

  it('mantém acentos no nome exibido', () => {
    expect(cupom.produtos[0].nome).toBe('Feijão Preto 1kg');
  });

  it('lê totais, data e pagamento', () => {
    expect(cupom).toMatchObject({
      subtotal: 25,
      descontoTotal: 0.5,
      total: 24.5,
      data: '2026-10-15T18:30:12-03:00',
      formaPagamento: 'PIX',
    });
    expect(cupom.estabelecimento.nome).toBe('Mercado Bom Preço');
  });
});

describe('extração do HTML da consulta pública', () => {
  const nfce = extrairDadosNFCe({ htmlContent: htmlNFCe })!;

  it('lê os itens', () => {
    expect(nfce.produtos).toEqual([
      expect.objectContaining({
        nome: 'ARROZ TIPO 1 5KG',
        ean: '4006381333931',
        quantidade: 2,
        valorUnitario: 25.9,
        valorTotal: 51.8,
      }),
      expect.objectContaining({ nome: 'BANANA PRATA KG', quantidade: 1.235, unidade: 'KG' }),
    ]);
  });

  it('lê emitente, totais, pagamento e emissão', () => {
    expect(nfce.emitente).toMatchObject({
      nome: 'SUPERMERCADO CENTRAL',
      cnpj: CNPJ_COM_ZERO,
      cidade: 'CAMPINAS',
      uf: 'SP',
    });
    expect(nfce.totais).toEqual({ subtotal: 1060.43, desconto: 0.43, total: 1060 });
    expect(nfce.pagamentos).toEqual([{ tipo: 'Cartão de Débito', valor: 1060 }]);
    expect(nfce.dataEmissao).toBe('2026-10-15T18:30:12-03:00');
  });

  it('retorna null para páginas fora do layout (ex.: CAPTCHA)', () => {
    expect(extrairDadosNFCe({ htmlContent: '<html><form>captcha</form></html>' })).toBeNull();
  });
});

describe('utilitários', () => {
  it('parseValorBR', () => {
    expect(parseValorBR('1.234,56')).toBe(1234.56);
    expect(parseValorBR('R$ 0,99')).toBe(0.99);
  });

  it('gtinValido', () => {
    expect(gtinValido('4006381333931')).toBe('4006381333931');
    expect(gtinValido('4006381333932')).toBeNull();
    expect(gtinValido('SEM GTIN')).toBeNull();
  });

  it('normalizeProdutoNome', () => {
    expect(normalizeProdutoNome('  ÓLEO   DE SOJA ')).toBe('Óleo De Soja');
  });
});
