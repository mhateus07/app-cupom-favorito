import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export type Pool = pg.Pool;

export const criarPool = (databaseUrl: string): Pool =>
  new pg.Pool({ connectionString: databaseUrl, max: 10 });

const PASTA_MIGRACOES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

/**
 * Aplica, em ordem, os arquivos de migrations/ que ainda não rodaram. A trava evita que
 * duas instâncias da API migrem ao mesmo tempo.
 */
export const migrar = async (pool: Pool, pasta = PASTA_MIGRACOES): Promise<string[]> => {
  const cliente = await pool.connect();
  const aplicadas: string[] = [];
  try {
    await cliente.query('SELECT pg_advisory_lock(7310021)');
    await cliente.query(
      'CREATE TABLE IF NOT EXISTS migracoes (nome TEXT PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now())'
    );
    const { rows } = await cliente.query<{ nome: string }>('SELECT nome FROM migracoes');
    const feitas = new Set(rows.map(row => row.nome));
    const arquivos = (await readdir(pasta)).filter(nome => nome.endsWith('.sql')).sort();

    for (const arquivo of arquivos) {
      if (feitas.has(arquivo)) continue;
      const sql = await readFile(path.join(pasta, arquivo), 'utf8');
      await cliente.query('BEGIN');
      try {
        await cliente.query(sql);
        await cliente.query('INSERT INTO migracoes (nome) VALUES ($1)', [arquivo]);
        await cliente.query('COMMIT');
        aplicadas.push(arquivo);
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await cliente.query('SELECT pg_advisory_unlock(7310021)').catch(() => {});
    cliente.release();
  }
  return aplicadas;
};
