import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

/**
 * Mapa de códigos UF para siglas de estados
 */
const UF_MAP: { [key: string]: string } = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
};

/**
 * Mapa de URLs de consulta por UF
 * Fonte: https://blog.tecnospeed.com.br/urls-de-consulta-da-chave-da-nfc-e-lista-completa-e-atualizada/
 */
const SEFAZ_URLS: { [key: string]: string } = {
  SP: 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx',
  RJ: 'http://www4.fazenda.rj.gov.br/consultaNFCe/QRCode',
  MG: 'http://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
  RS: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
  PR: 'http://www.fazenda.pr.gov.br/nfce/qrcode',
  SC: 'https://sat.sef.sc.gov.br/nfce/consulta',
  BA: 'http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode/qrcode.aspx',
  CE: 'http://nfce.sefaz.ce.gov.br/pages/consultaNota.jsf',
  GO: 'http://nfe.go.gov.br/sistemas/nfce/qrcode',
  MT: 'http://www.sefaz.mt.gov.br/nfce/consultanfce',
  MS: 'http://www.dfe.ms.gov.br/nfce/qrcode',
  PE: 'https://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe',
  AM: 'https://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp',
  ES: 'http://app.sefaz.es.gov.br/ConsultaNFCe',
  PA: 'https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/consultanfce.seam',
  PB: 'https://www.receita.pb.gov.br/nfce',
  PI: 'http://webas.sefaz.pi.gov.br/nfce/qrcode',
  RN: 'http://nfce.set.rn.gov.br/consultarNFCe.aspx',
  RO: 'http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp',
  AL: 'http://nfce.sefaz.al.gov.br/consultaNFCe.htm',
  AC: 'http://sefaznet.ac.gov.br/nfce/qrcode',
  AP: 'https://www.sefaz.ap.gov.br/nfce/consulta',
  DF: 'http://dec.fazenda.df.gov.br/ConsultarNFCe.aspx',
  MA: 'http://www.nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp',
  SE: 'http://www.nfce.se.gov.br/portal/consultarNFCe.jsp',
  TO: 'https://www.sefaz.to.gov.br/nfce/consulta',
  RR: 'https://www.sefaz.rr.gov.br/nfce/servlet/wp_consulta_nfce',
};

/**
 * Códigos de tipo de pagamento
 */
const PAYMENT_TYPES: { [key: string]: string } = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '14': 'Duplicata Mercantil',
  '15': 'Boleto Bancário',
  '90': 'Sem Pagamento',
  '99': 'Outros',
};

export interface SefazConsultaResult {
  success: boolean;
  xmlContent?: string;
  htmlContent?: string;
  error?: string;
  uf?: string;
  chaveAcesso: string;
}

/**
 * Extrai a UF (estado) de uma chave de acesso
 */
export const getUFFromChave = (chaveAcesso: string): string | null => {
  if (chaveAcesso.length !== 44) {
    return null;
  }

  const codigoUF = chaveAcesso.substring(0, 2);
  return UF_MAP[codigoUF] || null;
};

/**
 * Obtém a URL de consulta SEFAZ para uma UF
 */
export const getConsultaURL = (uf: string): string | null => {
  return SEFAZ_URLS[uf.toUpperCase()] || null;
};

/**
 * Consulta dados da NFCe na SEFAZ através do QR Code
 *
 * IMPORTANTE: Esta implementação tenta fazer requisição direta ao portal SEFAZ.
 * Limitações:
 * - Muitos portais possuem CAPTCHA
 * - Alguns portais bloqueiam requisições de apps mobile
 * - A estrutura HTML pode mudar
 *
 * Para produção, considere usar uma API comercial (Webmania, Focus NFE, etc.)
 */
export const consultarNFCe = async (
  qrCodeUrl: string,
  chaveAcesso: string
): Promise<SefazConsultaResult> => {
  try {
    const uf = getUFFromChave(chaveAcesso);

    if (!uf) {
      return {
        success: false,
        error: 'Não foi possível identificar a UF da chave de acesso',
        chaveAcesso,
      };
    }

    // Tentar fazer requisição à URL do QR Code diretamente
    console.log(`Consultando NFCe na SEFAZ/${uf}...`);
    console.log(`URL: ${qrCodeUrl}`);

    try {
      const response = await axios.get(qrCodeUrl, {
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      // Verificar se retornou XML ou HTML
      const contentType = response.headers['content-type'] || '';
      const content = response.data;

      if (contentType.includes('xml') || content.includes('<?xml')) {
        // Retornou XML diretamente (raro, mas possível)
        return {
          success: true,
          xmlContent: content,
          uf,
          chaveAcesso,
        };
      } else {
        // Retornou HTML (padrão)
        // Tentar extrair XML embutido no HTML
        const xmlMatch = content.match(/<\?xml[\s\S]*<\/nfeProc>/);
        if (xmlMatch) {
          return {
            success: true,
            xmlContent: xmlMatch[0],
            htmlContent: content,
            uf,
            chaveAcesso,
          };
        }

        // Apenas HTML, sem XML
        return {
          success: true,
          htmlContent: content,
          uf,
          chaveAcesso,
        };
      }
    } catch (requestError) {
      console.error('Erro na requisição à SEFAZ:', requestError);

      return {
        success: false,
        error: `Erro ao consultar SEFAZ/${uf}: ${
          requestError instanceof Error ? requestError.message : 'Erro desconhecido'
        }`,
        uf,
        chaveAcesso,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      chaveAcesso,
    };
  }
};

/**
 * Parse XML da NFCe usando fast-xml-parser
 */
export const parseXML = (xmlContent: string): any => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: true,
    parseTagValue: true,
    trimValues: true,
  });

  return parser.parse(xmlContent);
};

/**
 * Extrai dados específicos do XML da NFCe
 */
export const extractNFCeData = (parsedXML: any) => {
  try {
    // Navegação no XML pode variar, mas geralmente é:
    // nfeProc -> NFe -> infNFe
    const nfeProc = parsedXML.nfeProc || parsedXML;
    const nfe = nfeProc.NFe || nfeProc.nfe || nfeProc;
    const infNFe = nfe.infNFe || nfe.infNfe || nfe;

    // Dados do emitente (estabelecimento)
    const emit = infNFe.emit || {};
    const enderEmit = emit.enderEmit || {};

    // Dados gerais (IDE)
    const ide = infNFe.ide || {};

    // Produtos (det - pode ser array ou objeto único)
    let detalhes = infNFe.det || [];
    if (!Array.isArray(detalhes)) {
      detalhes = [detalhes];
    }

    // Totais
    const total = infNFe.total || {};
    const icmsTot = total.ICMSTot || {};

    // Pagamento
    const pag = infNFe.pag || {};
    let pagamentos = pag.detPag || [];
    if (!Array.isArray(pagamentos)) {
      pagamentos = [pagamentos];
    }

    return {
      chaveAcesso: infNFe['@_Id']?.replace('NFe', '') || '',
      numero: ide.nNF || '',
      serie: ide.serie || '',
      dataEmissao: ide.dhEmi || ide.dEmi || '',
      emitente: {
        cnpj: emit.CNPJ || emit.CPF || '',
        nome: emit.xNome || '',
        nomeFantasia: emit.xFant || emit.xNome || '',
        endereco: `${enderEmit.xLgr || ''}, ${enderEmit.nro || ''}`,
        bairro: enderEmit.xBairro || '',
        cidade: enderEmit.xMun || '',
        uf: enderEmit.UF || '',
        cep: enderEmit.CEP || '',
      },
      produtos: detalhes.map((det: any) => {
        const prod = det.prod || {};
        return {
          codigo: prod.cProd || '',
          ean: prod.cEAN || '',
          nome: prod.xProd || '',
          ncm: prod.NCM || '',
          unidade: prod.uCom || '',
          quantidade: parseFloat(prod.qCom || '0'),
          valorUnitario: parseFloat(prod.vUnCom || '0'),
          valorTotal: parseFloat(prod.vProd || '0'),
          desconto: parseFloat(prod.vDesc || '0'),
        };
      }),
      totais: {
        subtotal: parseFloat(icmsTot.vProd || '0'),
        desconto: parseFloat(icmsTot.vDesc || '0'),
        total: parseFloat(icmsTot.vNF || '0'),
        icms: parseFloat(icmsTot.vICMS || '0'),
      },
      pagamentos: pagamentos.map((p: any) => ({
        tipo: PAYMENT_TYPES[p.tPag] || 'Outros',
        codigo: p.tPag || '',
        valor: parseFloat(p.vPag || '0'),
      })),
    };
  } catch (error) {
    console.error('Erro ao extrair dados do XML:', error);
    throw error;
  }
};

/**
 * Converte código de tipo de pagamento para descrição
 */
export const getPaymentDescription = (codigo: string): string => {
  return PAYMENT_TYPES[codigo] || 'Outros';
};
