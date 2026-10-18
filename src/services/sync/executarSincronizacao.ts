import { AlteracaoSync } from '../../models/types';

export interface RespostaSync {
  cursor: number;
  temMais: boolean;
  alteracoes: AlteracaoSync[];
}

/** O que a sincronização precisa do banco local e da API (injetado para testar) */
export interface DependenciasSync {
  lerPendentes: (limite: number) => Promise<AlteracaoSync[]>;
  confirmarEnviados: (enviados: AlteracaoSync[]) => Promise<void>;
  aplicarAlteracoesRemotas: (alteracoes: AlteracaoSync[]) => Promise<number>;
  lerCursor: () => Promise<number>;
  salvarCursor: (cursor: number) => Promise<void>;
  enviar: (desde: number, alteracoes: AlteracaoSync[]) => Promise<RespostaSync>;
}

const MAXIMO_RODADAS = 100;

/**
 * Envia a fila local em lotes e aplica o que veio do servidor, até não sobrar nada
 * dos dois lados. A fila é confirmada antes de aplicar a resposta: assim a cópia que
 * volta do servidor não é descartada como "mais antiga que a pendente".
 */
export const executarSincronizacao = async (
  deps: DependenciasSync,
  limite = 500
): Promise<{ enviadas: number; recebidas: number }> => {
  let enviadas = 0;
  let recebidas = 0;

  for (let rodada = 0; rodada < MAXIMO_RODADAS; rodada++) {
    const pendentes = await deps.lerPendentes(limite);
    const resposta = await deps.enviar(await deps.lerCursor(), pendentes);
    await deps.confirmarEnviados(pendentes);
    recebidas += await deps.aplicarAlteracoesRemotas(resposta.alteracoes);
    await deps.salvarCursor(resposta.cursor);
    enviadas += pendentes.length;
    if (!resposta.temMais && pendentes.length < limite) break;
  }
  return { enviadas, recebidas };
};
