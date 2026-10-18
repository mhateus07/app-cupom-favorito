import { XMLParser } from 'fast-xml-parser';

/**
 * Códigos de tipo de pagamento (tag tPag da NF-e)
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
  '16': 'Depósito Bancário',
  '17': 'PIX',
  '18': 'Transferência Bancária',
  '19': 'Programa de Fidelidade',
  '20': 'PIX',
  '90': 'Sem Pagamento',
  '99': 'Outros',
};

export interface NFCeProduto {
  codigo: string;
  ean: string;
  nome: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number; // Valor bruto do item (vProd)
  desconto: number;
}

export interface NFCeData {
  chaveAcesso: string;
  dataEmissao: string;
  emitente: {
    cnpj: string;
    nome: string;
    nomeFantasia: string;
    endereco: string;
    cidade: string;
    uf: string;
  };
  produtos: NFCeProduto[];
  totais: {
    subtotal: number;
    desconto: number;
    total: number;
  };
  pagamentos: Array<{ tipo: string; valor: number }>;
}

/**
 * Converte código de tipo de pagamento para descrição
 */
export const getPaymentDescription = (codigo: string): string => {
  return PAYMENT_TYPES[codigo] || 'Outros';
};

/**
 * Retorna o GTIN (código de barras) se for válido, ou null.
 * Na NF-e, produtos sem código de barras vêm como "SEM GTIN".
 */
export const gtinValido = (valor: string | null | undefined): string | null => {
  const digitos = String(valor ?? '').trim();
  if (!/^(\d{8}|\d{12,14})$/.test(digitos) || /^0+$/.test(digitos)) {
    return null;
  }

  // Dígito verificador GS1
  const corpo = digitos.slice(0, -1);
  let soma = 0;
  for (let i = 0; i < corpo.length; i++) {
    // Da direita para a esquerda, os pesos alternam 3, 1, 3, 1...
    soma += Number(corpo[corpo.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  }
  const dv = (10 - (soma % 10)) % 10;
  return dv === Number(digitos[digitos.length - 1]) ? digitos : null;
};

// O XML da NF-e não tem esquema tipado aqui; os campos são lidos de forma defensiva
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XmlNode = any;

const toNumber = (valor: unknown): number => {
  const n = parseFloat(String(valor ?? '0'));
  return Number.isFinite(n) ? n : 0;
};

const toArray = <T>(valor: T | T[] | undefined): T[] => {
  if (valor === undefined || valor === null || valor === '') return [];
  return Array.isArray(valor) ? valor : [valor];
};

const texto = (valor: unknown): string =>
  valor === undefined || valor === null ? '' : String(valor);

/**
 * Parse XML da NFCe usando fast-xml-parser.
 * Todos os valores são mantidos como texto para não perder zeros à esquerda
 * (CNPJ, GTIN, CEP, código do produto).
 */
export const parseXML = (xmlContent: string): Record<string, XmlNode> => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
  });

  return parser.parse(xmlContent);
};

/**
 * Extrai dados específicos do XML da NFCe (nfeProc -> NFe -> infNFe)
 */
export const extractNFCeData = (parsedXML: Record<string, XmlNode>): NFCeData => {
  const nfeProc = parsedXML.nfeProc || parsedXML;
  const nfe = nfeProc.NFe || nfeProc.nfe || nfeProc;
  const infNFe = nfe.infNFe || nfe.infNfe;

  if (!infNFe) {
    throw new Error('XML não contém o grupo infNFe');
  }

  const emit = infNFe.emit || {};
  const enderEmit = emit.enderEmit || {};
  const ide = infNFe.ide || {};
  const icmsTot = infNFe.total?.ICMSTot || {};

  return {
    chaveAcesso: texto(infNFe['@_Id']).replace(/^NFe/, ''),
    dataEmissao: texto(ide.dhEmi || ide.dEmi),
    emitente: {
      cnpj: texto(emit.CNPJ || emit.CPF),
      nome: texto(emit.xNome),
      nomeFantasia: texto(emit.xFant || emit.xNome),
      endereco: [enderEmit.xLgr, enderEmit.nro, enderEmit.xBairro]
        .map(texto)
        .filter(Boolean)
        .join(', '),
      cidade: texto(enderEmit.xMun),
      uf: texto(enderEmit.UF),
    },
    produtos: toArray<XmlNode>(infNFe.det).map(det => {
      const prod = det.prod || {};
      return {
        codigo: texto(prod.cProd),
        ean: texto(prod.cEAN),
        nome: texto(prod.xProd),
        unidade: texto(prod.uCom),
        quantidade: toNumber(prod.qCom),
        valorUnitario: toNumber(prod.vUnCom),
        valorTotal: toNumber(prod.vProd),
        desconto: toNumber(prod.vDesc),
      };
    }),
    totais: {
      subtotal: toNumber(icmsTot.vProd),
      desconto: toNumber(icmsTot.vDesc),
      total: toNumber(icmsTot.vNF),
    },
    pagamentos: toArray<XmlNode>(infNFe.pag?.detPag).map(p => ({
      tipo: getPaymentDescription(texto(p.tPag)),
      valor: toNumber(p.vPag),
    })),
  };
};

// ---------------------------------------------------------------------------
// HTML da consulta pública
// ---------------------------------------------------------------------------

const ENTIDADES: { [key: string]: string } = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/**
 * Remove tags HTML e normaliza espaços
 */
const limparHTML = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z#0-9]+;/gi, entidade => ENTIDADES[entidade.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Converte valor no formato brasileiro ("1.234,56") para número
 */
export const parseValorBR = (valor: string): number => {
  const limpo = valor.replace(/[^\d,.-]/g, '');
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Converte "dd/MM/yyyy HH:mm:ss[-03:00]" para ISO 8601
 */
const parseDataBR = (valor: string): string => {
  const m = valor.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{2}:\d{2})?/
  );
  if (!m) return '';
  const [, dia, mes, ano, hora, minuto, segundo = '00', fuso = ''] = m;
  return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}${fuso}`;
};

const conteudoPorClasse = (html: string, classe: string): string | null => {
  const re = new RegExp(
    `<(\\w+)[^>]*class="[^"]*\\b${classe}\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1>`,
    'i'
  );
  const m = html.match(re);
  return m ? limparHTML(m[2]) : null;
};

/**
 * Extrai os dados do HTML da consulta pública da NFC-e.
 *
 * Suporta o layout padrão do portal nacional (tabela "tabResult", classes txtTit/RCod/
 * Rqtd/RvlUnit/valor), usado pela maioria das SEFAZ (SP, RS, PR, BA, GO, entre outras).
 * Retorna null quando o HTML não segue esse layout — ex.: página com CAPTCHA ou portal
 * com layout próprio.
 */
export const extractNFCeDataFromHTML = (html: string): NFCeData | null => {
  const tabela = html.match(/<table[^>]*id="tabResult"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tabela) return null;

  const linhas = tabela[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  const produtos: NFCeProduto[] = linhas
    .map(linha => {
      const nome = conteudoPorClasse(linha, 'txtTit');
      if (!nome) return null;

      const codigo = (conteudoPorClasse(linha, 'RCod') || '').match(/\d+/)?.[0] || '';
      const quantidade = parseValorBR(
        (conteudoPorClasse(linha, 'Rqtd') || '').replace(/Qtde\.?:?/i, '')
      );
      const unidade = (conteudoPorClasse(linha, 'RUN') || '').replace(/UN:?/i, '').trim();
      const valorUnitario = parseValorBR(
        (conteudoPorClasse(linha, 'RvlUnit') || '').replace(/Vl\.?\s*Unit\.?:?/i, '')
      );
      const valorTotal = parseValorBR(conteudoPorClasse(linha, 'valor') || '0');

      return {
        codigo,
        ean: codigo,
        nome,
        unidade,
        quantidade: quantidade || 1,
        valorUnitario,
        valorTotal,
        desconto: 0, // O HTML só informa o desconto total da nota
      };
    })
    .filter((p): p is NFCeProduto => p !== null);

  if (produtos.length === 0) return null;

  // Totais: cada linha é "<label>Descrição</label><span class="totalNumb">valor</span>"
  const linhasTotal = [
    ...html.matchAll(
      /<label[^>]*>([\s\S]*?)<\/label>\s*<span[^>]*class="[^"]*totalNumb[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
    ),
  ].map(m => ({ rotulo: limparHTML(m[1]), valor: limparHTML(m[2]) }));

  const valorTotal = (padrao: RegExp): number | null => {
    const linha = linhasTotal.find(l => padrao.test(l.rotulo));
    return linha ? parseValorBR(linha.valor) : null;
  };

  const subtotal =
    valorTotal(/^Valor total/i) ?? produtos.reduce((soma, p) => soma + p.valorTotal, 0);
  const desconto = valorTotal(/^Descontos?/i) ?? 0;
  const total = valorTotal(/^Valor a pagar/i) ?? subtotal - desconto;

  // Pagamentos aparecem depois da linha "Forma de pagamento", até "Troco"
  const inicioPagamentos = linhasTotal.findIndex(l => /Forma de pagamento/i.test(l.rotulo));
  const pagamentos =
    inicioPagamentos >= 0
      ? linhasTotal
          .slice(inicioPagamentos + 1)
          .filter(l => l.rotulo && !/Troco/i.test(l.rotulo))
          .map(l => ({ tipo: l.rotulo, valor: parseValorBR(l.valor) }))
      : [];

  // Emitente: nome em #u20 (ou .txtTopo), seguido de linhas .text com CNPJ e endereço
  const nomeEmitente =
    html.match(/<div[^>]*id="u20"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    conteudoPorClasse(html, 'txtTopo') ??
    '';
  const linhasTexto = [...html.matchAll(/<div[^>]*class="text"[^>]*>([\s\S]*?)<\/div>/gi)].map(m =>
    limparHTML(m[1])
  );
  const cnpj = (linhasTexto.find(l => /CNPJ/i.test(l)) || '').replace(/\D/g, '');
  const enderecoCompleto = linhasTexto.find(l => !/CNPJ/i.test(l)) || '';
  const partesEndereco = enderecoCompleto
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);
  const uf = /^[A-Z]{2}$/.test(partesEndereco[partesEndereco.length - 1] || '')
    ? partesEndereco.pop() || ''
    : '';
  const cidade = partesEndereco.pop() || '';

  const textoPagina = limparHTML(html);
  const emissao = textoPagina.match(
    /Emiss[ãa]o:?\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?\s*(?:[+-]\d{2}:\d{2})?)/i
  );
  const chave = textoPagina.replace(/\s/g, '').match(/\d{44}/)?.[0] || '';

  return {
    chaveAcesso: chave,
    dataEmissao: emissao ? parseDataBR(emissao[1]) : '',
    emitente: {
      cnpj,
      nome: limparHTML(nomeEmitente),
      nomeFantasia: limparHTML(nomeEmitente),
      endereco: partesEndereco.join(', '),
      cidade,
      uf,
    },
    produtos,
    totais: { subtotal, desconto, total },
    pagamentos,
  };
};
