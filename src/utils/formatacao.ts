import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const parseData = (data: string): Date | null => {
  const d = parseISO(data);
  return isValid(d) ? d : null;
};

/**
 * Valor sem símbolo de moeda, para colunas numéricas em Geist Mono: 212.87 → "212,87"
 */
export const formatarValor = (valor: number): string =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    valor
  );

/** "14 OUT" */
export const formatarDiaMes = (data: string): string => {
  const d = parseData(data);
  return d ? format(d, 'dd MMM', { locale: ptBR }).replace('.', '').toUpperCase() : data;
};

/** "18:42", ou vazio se a data não tiver horário */
export const formatarHora = (data: string): string => {
  const d = parseData(data);
  return d && data.includes('T') ? format(d, 'HH:mm') : '';
};

/** "OUTUBRO" */
export const formatarMes = (data: string): string => {
  const d = parseData(data);
  return d ? format(d, 'MMMM', { locale: ptBR }).toUpperCase() : '';
};

const PALAVRAS_IGNORADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'ltda', 'me', 'sa']);

/** Iniciais do estabelecimento: "Mercado Central" → "MC" */
export const iniciais = (nome: string): string => {
  const palavras = nome
    .split(/\s+/)
    .map(p => p.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(p => p && !PALAVRAS_IGNORADAS.has(p.toLowerCase()));
  return (
    palavras
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase() || '?'
  );
};

/** Chave de acesso em grupos de 4 dígitos, como impressa no cupom */
export const formatarChaveAcesso = (chave: string): string =>
  chave.replace(/(\d{4})(?=\d)/g, '$1 ');
