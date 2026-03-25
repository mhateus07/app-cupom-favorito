import { CupomData, ProdutoData, EstabelecimentoData } from '../../models/types';
import {
  consultarNFCe,
  parseXML,
  extractNFCeData,
  getUFFromChave,
} from '../sefaz/sefazService';

export interface ParsedQRCode {
  chaveAcesso: string;
  url: string;
  isValid: boolean;
}

/**
 * Parse QR Code de NFCe
 * Formato típico: http://www.fazenda.sp.gov.br/nfce/qrcode?p=CHAVE_ACESSO|...
 */
export const parseQRCode = (qrCodeData: string): ParsedQRCode => {
  try {
    // Extrair chave de acesso (44 dígitos)
    const chaveMatch = qrCodeData.match(/\d{44}/);
    const chaveAcesso = chaveMatch ? chaveMatch[0] : '';

    const isValid = chaveAcesso.length === 44;

    return {
      chaveAcesso,
      url: qrCodeData,
      isValid,
    };
  } catch (error) {
    console.error('Erro ao parsear QR Code:', error);
    return {
      chaveAcesso: '',
      url: qrCodeData,
      isValid: false,
    };
  }
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
 * Parse XML da NFCe
 * Tenta consultar dados reais na SEFAZ, com fallback para dados mockados
 */
export const parseNFCeXML = async (
  chaveAcesso: string,
  url: string
): Promise<CupomData | null> => {
  try {
    console.log('🔍 Iniciando consulta NFCe...');
    console.log('Chave:', chaveAcesso);
    console.log('URL:', url);

    // Tentar consultar na SEFAZ
    const sefazResult = await consultarNFCe(url, chaveAcesso);

    if (sefazResult.success && sefazResult.xmlContent) {
      console.log('✅ XML obtido da SEFAZ! Fazendo parsing...');

      try {
        // Parsear XML
        const parsedXML = parseXML(sefazResult.xmlContent);
        const nfceData = extractNFCeData(parsedXML);

        // Converter para formato CupomData
        const cupomData = convertNFCeDataToCupomData(nfceData, chaveAcesso, url);
        console.log('✅ Dados extraídos com sucesso!');
        return cupomData;
      } catch (parseError) {
        console.error('❌ Erro ao parsear XML, usando dados mockados:', parseError);
        // Fallback para mock
        return createMockCupomDataFromChave(chaveAcesso, url);
      }
    } else {
      console.warn(
        '⚠️ Não foi possível obter XML da SEFAZ:',
        sefazResult.error
      );
      console.log('📝 Usando dados mockados para teste');

      // Fallback para dados mockados
      return createMockCupomDataFromChave(chaveAcesso, url);
    }
  } catch (error) {
    console.error('❌ Erro geral ao processar NFCe:', error);
    console.log('📝 Usando dados mockados para teste');

    // Fallback final para mock
    return createMockCupomDataFromChave(chaveAcesso, url);
  }
};

/**
 * Converte dados extraídos do XML NFCe para o formato CupomData
 */
const convertNFCeDataToCupomData = (
  nfceData: any,
  chaveAcesso: string,
  url: string
): CupomData => {
  const estabelecimento: EstabelecimentoData = {
    nome: nfceData.emitente.nomeFantasia || nfceData.emitente.nome,
    cnpj: nfceData.emitente.cnpj,
    endereco: nfceData.emitente.endereco,
    cidade: nfceData.emitente.cidade,
    estado: nfceData.emitente.uf,
  };

  const produtos: ProdutoData[] = nfceData.produtos.map((p: any) => ({
    nome: normalizeProdutoNome(p.nome),
    codigo: p.ean || p.codigo,
    preco: p.valorUnitario,
    quantidade: p.quantidade,
    desconto: p.desconto,
    precoFinal: p.valorTotal,
  }));

  // Pegar a primeira forma de pagamento (ou combinar se houver múltiplas)
  const formaPagamento =
    nfceData.pagamentos.length > 0
      ? nfceData.pagamentos[0].tipo
      : 'Não informado';

  return {
    chaveAcesso,
    qrCode: url,
    estabelecimento,
    produtos,
    data: nfceData.dataEmissao,
    subtotal: nfceData.totais.subtotal,
    descontoTotal: nfceData.totais.desconto,
    total: nfceData.totais.total,
    formaPagamento,
  };
};

/**
 * Criar dados mockados para teste (fallback quando não conseguir dados reais)
 */
const createMockCupomDataFromChave = (
  chaveAcesso: string,
  url: string
): CupomData => {
  const info = extractInfoFromChave(chaveAcesso);
  const uf = getUFFromChave(chaveAcesso) || 'SP';
  const estabelecimento: EstabelecimentoData = {
    nome: 'Supermercado Exemplo',
    cnpj: info.cnpj,
    endereco: 'Rua Exemplo, 123',
    cidade: uf === 'SP' ? 'São Paulo' : uf === 'RJ' ? 'Rio de Janeiro' : 'Cidade Exemplo',
    estado: uf,
  };

  const produtos: ProdutoData[] = [
    {
      nome: 'Arroz Tipo 1 5kg',
      codigo: '7891234567890',
      preco: 25.9,
      quantidade: 1,
      desconto: 0,
      precoFinal: 25.9,
    },
    {
      nome: 'Feijão Preto 1kg',
      codigo: '7891234567891',
      preco: 8.5,
      quantidade: 2,
      desconto: 0.5,
      precoFinal: 16.5,
    },
    {
      nome: 'Óleo de Soja 900ml',
      codigo: '7891234567892',
      preco: 6.99,
      quantidade: 1,
      desconto: 0,
      precoFinal: 6.99,
    },
  ];

  const subtotal = produtos.reduce((sum, p) => sum + p.preco * p.quantidade, 0);
  const descontoTotal = produtos.reduce((sum, p) => sum + p.desconto, 0);
  const total = subtotal - descontoTotal;

  return {
    chaveAcesso,
    qrCode: url,
    estabelecimento,
    produtos,
    data: new Date().toISOString(),
    subtotal,
    descontoTotal,
    total,
    formaPagamento: 'Dinheiro',
  };
};

/**
 * Normaliza nome de produto (remove acentos, capitaliza, etc)
 */
export const normalizeProdutoNome = (nome: string): string => {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' ') // Remove espaços extras
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
