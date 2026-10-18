import axios from 'axios';

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
 * Baixa a página de consulta da NFC-e a partir da URL do QR Code.
 *
 * O resultado pode conter o XML (raro) e/ou o HTML da consulta pública. Quem chama é
 * responsável por extrair os dados — ver nfceExtractor.ts.
 *
 * Limitações conhecidas:
 * - Alguns portais exigem CAPTCHA ou bloqueiam requisições fora do navegador
 * - Alguns estados usam um layout de HTML próprio
 *
 * Para cobertura completa em produção, considere uma API comercial (Webmania, Focus NFe etc.).
 */
export const consultarNFCe = async (
  qrCodeUrl: string,
  chaveAcesso: string
): Promise<SefazConsultaResult> => {
  const uf = getUFFromChave(chaveAcesso);

  if (!uf) {
    return {
      success: false,
      error: 'Não foi possível identificar o estado (UF) da chave de acesso.',
      chaveAcesso,
    };
  }

  if (!/^https?:\/\//i.test(qrCodeUrl)) {
    return {
      success: false,
      error: 'O QR Code não contém um endereço de consulta da SEFAZ.',
      uf,
      chaveAcesso,
    };
  }

  try {
    const response = await axios.get<string>(qrCodeUrl, {
      timeout: 15000,
      responseType: 'text',
      // Mantém o corpo como texto, sem tentativa de parse JSON
      transformResponse: [data => data],
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const content = typeof response.data === 'string' ? response.data : String(response.data ?? '');
    const contentType = String(response.headers['content-type'] || '');

    if (!content.trim()) {
      return {
        success: false,
        error: `A SEFAZ/${uf} retornou uma resposta vazia.`,
        uf,
        chaveAcesso,
      };
    }

    if (contentType.includes('xml') || content.trimStart().startsWith('<?xml')) {
      return { success: true, xmlContent: content, uf, chaveAcesso };
    }

    // Alguns portais embutem o XML completo dentro do HTML
    const xmlMatch = content.match(/<nfeProc[\s\S]*<\/nfeProc>/);

    return {
      success: true,
      xmlContent: xmlMatch?.[0],
      htmlContent: content,
      uf,
      chaveAcesso,
    };
  } catch (requestError) {
    console.error('Erro na requisição à SEFAZ:', requestError);

    return {
      success: false,
      error: `Não foi possível acessar a SEFAZ/${uf}: ${
        requestError instanceof Error ? requestError.message : 'erro desconhecido'
      }`,
      uf,
      chaveAcesso,
    };
  }
};
