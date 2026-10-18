import { executarSincronizacao, RespostaSync } from '../src/services/sync/executarSincronizacao';
import { AlteracaoSync } from '../src/models/types';

/** Servidor em memória com a mesma regra da API: vale o atualizadoEm mais recente */
const criarServidor = (limiteResposta = 1000) => {
  const registros = new Map<string, AlteracaoSync & { seq: number }>();
  let seq = 0;
  return {
    registros,
    enviar: async (desde: number, alteracoes: AlteracaoSync[]): Promise<RespostaSync> => {
      for (const alteracao of alteracoes) {
        const chave = `${alteracao.tipo}:${alteracao.chave}`;
        const atual = registros.get(chave);
        if (!atual || alteracao.atualizadoEm >= atual.atualizadoEm) {
          registros.set(chave, { ...alteracao, seq: ++seq });
        }
      }
      const novas = [...registros.values()]
        .filter(registro => registro.seq > desde)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limiteResposta);
      return {
        cursor: novas.length ? novas[novas.length - 1].seq : desde,
        temMais: novas.length === limiteResposta,
        alteracoes: novas.map(({ seq: _seq, ...alteracao }) => alteracao),
      };
    },
  };
};

/** Aparelho em memória: dados locais + fila de pendentes + cursor */
const criarAparelho = (servidor: ReturnType<typeof criarServidor>) => {
  const dados = new Map<string, AlteracaoSync>();
  const pendentes = new Map<string, AlteracaoSync>();
  let cursor = 0;
  const alterar = (alteracao: AlteracaoSync) => {
    const chave = `${alteracao.tipo}:${alteracao.chave}`;
    if (alteracao.excluido) dados.delete(chave);
    else dados.set(chave, alteracao);
    pendentes.set(chave, alteracao);
  };
  const sincronizar = (limite = 500) =>
    executarSincronizacao(
      {
        lerPendentes: async n => [...pendentes.values()].slice(0, n),
        confirmarEnviados: async enviados =>
          enviados.forEach(e => {
            const chave = `${e.tipo}:${e.chave}`;
            if (pendentes.get(chave)?.atualizadoEm === e.atualizadoEm) pendentes.delete(chave);
          }),
        aplicarAlteracoesRemotas: async alteracoes => {
          alteracoes.forEach(a => {
            const chave = `${a.tipo}:${a.chave}`;
            if (a.excluido) dados.delete(chave);
            else dados.set(chave, a);
          });
          return alteracoes.length;
        },
        lerCursor: async () => cursor,
        salvarCursor: async novo => {
          cursor = novo;
        },
        enviar: servidor.enviar,
      },
      limite
    );
  return { dados, pendentes, alterar, sincronizar };
};

const item = (
  chave: string,
  nome: string,
  atualizadoEm: string,
  excluido = false
): AlteracaoSync => ({
  tipo: 'item_lista',
  chave,
  dados: excluido ? null : { nome },
  excluido,
  atualizadoEm,
});

describe('executarSincronizacao', () => {
  it('leva os dados de um aparelho para o outro e esvazia a fila', async () => {
    const servidor = criarServidor();
    const celular = criarAparelho(servidor);
    const tablet = criarAparelho(servidor);

    celular.alterar(item('a', 'Arroz', '2026-10-01T10:00:00.000Z'));
    celular.alterar(item('b', 'Feijão', '2026-10-01T10:00:01.000Z'));
    expect(await celular.sincronizar()).toEqual({ enviadas: 2, recebidas: 2 });
    expect(celular.pendentes.size).toBe(0);

    await tablet.sincronizar();
    expect([...tablet.dados.keys()].sort()).toEqual(['item_lista:a', 'item_lista:b']);
  });

  it('propaga exclusões', async () => {
    const servidor = criarServidor();
    const celular = criarAparelho(servidor);
    const tablet = criarAparelho(servidor);
    celular.alterar(item('a', 'Arroz', '2026-10-01T10:00:00.000Z'));
    await celular.sincronizar();
    await tablet.sincronizar();

    tablet.alterar(item('a', '', '2026-10-02T10:00:00.000Z', true));
    await tablet.sincronizar();
    await celular.sincronizar();
    expect(celular.dados.size).toBe(0);
  });

  it('em conflito, os dois aparelhos ficam com a alteração mais recente', async () => {
    const servidor = criarServidor();
    const celular = criarAparelho(servidor);
    const tablet = criarAparelho(servidor);
    celular.alterar(item('a', 'Arroz 5kg', '2026-10-02T10:00:00.000Z'));
    tablet.alterar(item('a', 'Arroz 1kg', '2026-10-01T10:00:00.000Z'));

    await celular.sincronizar();
    await tablet.sincronizar();
    await celular.sincronizar();
    expect(celular.dados.get('item_lista:a')?.dados).toEqual({ nome: 'Arroz 5kg' });
    expect(tablet.dados.get('item_lista:a')?.dados).toEqual({ nome: 'Arroz 5kg' });
  });

  it('envia e recebe em lotes quando há mais registros que o limite', async () => {
    const servidor = criarServidor(3);
    const celular = criarAparelho(servidor);
    const tablet = criarAparelho(servidor);
    for (let i = 0; i < 7; i++) {
      celular.alterar(item(`i${i}`, `Item ${i}`, `2026-10-01T10:00:0${i}.000Z`));
    }
    await celular.sincronizar(2);
    expect(celular.pendentes.size).toBe(0);
    expect(servidor.registros.size).toBe(7);

    await tablet.sincronizar(2);
    expect(tablet.dados.size).toBe(7);
  });

  it('mantém na fila o que mudou de novo durante o envio e envia depois', async () => {
    const servidor = criarServidor();
    const celular = criarAparelho(servidor);
    celular.alterar(item('a', 'Arroz', '2026-10-01T10:00:00.000Z'));
    const enviarOriginal = servidor.enviar;
    servidor.enviar = async (desde, alteracoes) => {
      // O usuário edita o item enquanto a requisição está no ar
      celular.alterar(item('a', 'Arroz integral', '2026-10-01T10:00:05.000Z'));
      servidor.enviar = enviarOriginal;
      return enviarOriginal(desde, alteracoes);
    };

    await celular.sincronizar();
    expect(celular.pendentes.get('item_lista:a')?.dados).toEqual({ nome: 'Arroz integral' });

    await celular.sincronizar();
    expect(celular.pendentes.size).toBe(0);
    expect(servidor.registros.get('item_lista:a')?.dados).toEqual({ nome: 'Arroz integral' });
  });
});
