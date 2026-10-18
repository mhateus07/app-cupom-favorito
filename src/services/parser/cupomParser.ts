import { CupomData, ProdutoData, EstabelecimentoData } from '../../models/types';
import { consultarNFCe } from '../sefaz/sefazService';
import {
  NFCeData,
  extractNFCeData,
  extractNFCeDataFromHTML,
  gtinValido,
  parseXML,
} from '../sefaz/nfceExtractor';

export interface ParsedQRCode {
  chaveAcesso: string;
  url: string;
  isValid: boolean;
}

/**
 * Erro com mensagem pronta para ser exibida ao usuário
 */
export class CupomIndisponivelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CupomIndisponivelError';
  }
}

/**
 * Calcula o dígito verificador (módulo 11) dos 43 primeiros dígitos da chave de acesso
 */
export const calcularDigitoVerificador = (chave43: string): number => {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
};

export const isChaveAcessoValida = (chave: string): boolean =>
  /^\d{44}$/.test(chave) && calcularDigitoVerificador(chave.slice(0, 43)) === Number(chave[43]);

/**
 * Parse QR Code de NFCe
 * Formato típico: https://www.nfce.fazenda.sp.gov.br/...?p=CHAVE_ACESSO|2|1|1|HASH
 */
export const parseQRCode = (qrCodeData: string): ParsedQRCode => {
  const data = qrCodeData.trim();

  // Prioriza o parâmetro "p" (padrão do QR Code da NFC-e); senão, qualquer sequência de 44 dígitos
  const candidatos = [data.match(/[?&]p=(\d{44})/)?.[1], ...(data.match(/\d{44}/g) || [])].filter(
    (c): c is string => Boolean(c)
  );
  const chaveAcesso = candidatos.find(isChaveAcessoValida) || '';

  return {
    chaveAcesso,
    url: data,
    isValid: chaveAcesso !== '',
  };
};

/**
 * Extrai informações básicas da chave de acesso
 * Formato da chave: UF + AAMM + CNPJ + Modelo + Série + Número + Código Numérico + Dígito Verificador
 */
export const extractInfoFromChave = (chaveAcesso: string) => {
  if (chaveAcesso.length !== 44) {
    throw new Error('Chave de acesso inválida');
  }

  return {
    uf: chaveAcesso.substring(0, 2),
    anoMes: chaveAcesso.substring(2, 6),
    cnpj: chaveAcesso.substring(6, 20),
    modelo: chaveAcesso.substring(20, 22),
    serie: chaveAcesso.substring(22, 25),
    numero: chaveAcesso.substring(25, 34),
    codigoNumerico: chaveAcesso.substring(34, 43),
    digitoVerificador: chaveAcesso.substring(43, 44),
  };
};

/**
 * Extrai os dados da NFC-e do conteúdo retornado pela SEFAZ (XML ou HTML).
 * Retorna null se nenhum formato conhecido for encontrado.
 */
export const extrairDadosNFCe = (conteudo: {
  xmlContent?: string;
  htmlContent?: string;
}): NFCeData | null => {
  if (conteudo.xmlContent) {
    try {
      return extractNFCeData(parseXML(conteudo.xmlContent));
    } catch (error) {
      console.warn('XML da NFC-e inválido, tentando o HTML:', error);
    }
  }

  if (conteudo.htmlContent) {
    return extractNFCeDataFromHTML(conteudo.htmlContent);
  }

  return null;
};

/**
 * Consulta a NFC-e na SEFAZ e devolve os dados do cupom.
 * Lança CupomIndisponivelError quando não for possível obter dados reais —
 * nunca devolve dados inventados.
 */
export const obterDadosCupom = async (chaveAcesso: string, url: string): Promise<CupomData> => {
  const resultado = await consultarNFCe(url, chaveAcesso);

  if (!resultado.success) {
    throw new CupomIndisponivelError(
      resultado.error || 'Não foi possível consultar o cupom na SEFAZ.'
    );
  }

  const nfceData = extrairDadosNFCe(resultado);

  if (!nfceData || nfceData.produtos.length === 0) {
    throw new CupomIndisponivelError(
      `A SEFAZ${resultado.uf ? `/${resultado.uf}` : ''} respondeu, mas não foi possível ler os ` +
        'itens do cupom. O portal pode estar pedindo CAPTCHA ou usar um formato ainda não suportado.'
    );
  }

  return convertNFCeDataToCupomData(nfceData, chaveAcesso, url);
};

const arredondar = (valor: number): number => Math.round(valor * 100) / 100;

/**
 * Converte dados extraídos da NFCe para o formato CupomData
 */
export const convertNFCeDataToCupomData = (
  nfceData: NFCeData,
  chaveAcesso: string,
  url: string
): CupomData => {
  const info = extractInfoFromChave(chaveAcesso);
  const cnpjEmitente = nfceData.emitente.cnpj.replace(/\D/g, '');

  const estabelecimento: EstabelecimentoData = {
    nome: nfceData.emitente.nomeFantasia || nfceData.emitente.nome || 'Estabelecimento',
    // O CNPJ também faz parte da chave de acesso; usa-o se a página não informar
    cnpj: cnpjEmitente ? cnpjEmitente.padStart(14, '0') : info.cnpj,
    endereco: nfceData.emitente.endereco || undefined,
    cidade: nfceData.emitente.cidade || undefined,
    estado: nfceData.emitente.uf || undefined,
  };

  const produtos: ProdutoData[] = nfceData.produtos.map(p => {
    const gtin = gtinValido(p.ean);
    const bruto = p.valorTotal || p.valorUnitario * p.quantidade;
    return {
      nome: normalizeProdutoNome(p.nome),
      codigo: gtin || p.codigo,
      gtin,
      preco: p.valorUnitario,
      quantidade: p.quantidade,
      desconto: p.desconto,
      precoFinal: arredondar(bruto - p.desconto),
    };
  });

  const formaPagamento =
    [...new Set(nfceData.pagamentos.map(p => p.tipo).filter(Boolean))].join(' + ') ||
    'Não informado';

  return {
    chaveAcesso,
    qrCode: url,
    estabelecimento,
    produtos,
    data: nfceData.dataEmissao || `20${info.anoMes.slice(0, 2)}-${info.anoMes.slice(2)}-01`,
    subtotal: nfceData.totais.subtotal,
    descontoTotal: nfceData.totais.desconto,
    total: nfceData.totais.total,
    formaPagamento,
  };
};

/**
 * Normaliza nome de produto para exibição (espaços e capitalização), mantendo os acentos
 */
export const normalizeProdutoNome = (nome: string): string => {
  return nome
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1))
    .join(' ');
};
