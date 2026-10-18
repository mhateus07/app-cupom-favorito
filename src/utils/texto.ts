/**
 * Gera uma chave de comparação para o nome do produto: sem acentos, minúsculo, sem espaços extras
 */
export const normalizarChaveNome = (nome: string): string => {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
};
