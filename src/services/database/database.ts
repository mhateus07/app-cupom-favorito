import * as SQLite from 'expo-sqlite';
import { CupomData, EstabelecimentoData, ProdutoData } from '../../models/types';
import { normalizarChaveNome } from '../../utils/texto';

const DB_NAME = 'cupom_favorito.db';

let db: SQLite.SQLiteDatabase | null = null;

interface CupomRow {
  id: number;
  chave_acesso: string;
  qr_code: string;
  estabelecimento_id: number;
  data: string;
  subtotal: number;
  desconto_total: number;
  total: number;
  forma_pagamento: string;
  estabelecimento_nome: string;
  cnpj: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
}

interface ProdutoRow {
  id: number;
  cupom_id: number;
  nome: string;
  codigo: string;
  gtin: string | null;
  preco: number;
  quantidade: number;
  desconto: number;
  preco_final: number;
}

/**
 * Migrações do schema. Cada posição do array corresponde a uma versão (PRAGMA user_version).
 * Nunca altere uma migração já publicada: adicione uma nova no final.
 */
const MIGRATIONS: string[] = [
  // v1: schema inicial
  `
  CREATE TABLE IF NOT EXISTS estabelecimentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cnpj TEXT UNIQUE NOT NULL,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave_acesso TEXT UNIQUE NOT NULL,
    qr_code TEXT NOT NULL,
    estabelecimento_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    subtotal REAL NOT NULL,
    desconto_total REAL NOT NULL,
    total REAL NOT NULL,
    forma_pagamento TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estabelecimento_id) REFERENCES estabelecimentos (id)
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cupom_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    nome_normalizado TEXT NOT NULL,
    codigo TEXT NOT NULL,
    preco REAL NOT NULL,
    quantidade REAL NOT NULL,
    desconto REAL NOT NULL,
    preco_final REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cupom_id) REFERENCES cupons (id)
  );

  CREATE INDEX IF NOT EXISTS idx_cupons_data ON cupons(data);
  CREATE INDEX IF NOT EXISTS idx_cupons_estabelecimento ON cupons(estabelecimento_id);
  CREATE INDEX IF NOT EXISTS idx_produtos_cupom ON produtos(cupom_id);
  CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome_normalizado);
  CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);
  `,

  // v2: GTIN separado do código, limpeza dos dados fictícios e correção de vínculos
  `
  ALTER TABLE produtos ADD COLUMN gtin TEXT;
  CREATE INDEX IF NOT EXISTS idx_produtos_gtin ON produtos(gtin);

  -- Versões anteriores gravavam um cupom fictício quando a SEFAZ falhava
  DELETE FROM produtos WHERE cupom_id IN (
    SELECT c.id FROM cupons c
    JOIN estabelecimentos e ON e.id = c.estabelecimento_id
    WHERE e.nome = 'Supermercado Exemplo' AND e.endereco = 'Rua Exemplo, 123'
  );
  DELETE FROM cupons WHERE estabelecimento_id IN (
    SELECT id FROM estabelecimentos
    WHERE nome = 'Supermercado Exemplo' AND endereco = 'Rua Exemplo, 123'
  );
  DELETE FROM estabelecimentos
  WHERE nome = 'Supermercado Exemplo' AND endereco = 'Rua Exemplo, 123';

  -- Um bug no upsert gravava estabelecimento_id errado. O CNPJ do emitente está na
  -- chave de acesso (posições 7 a 20), então dá para refazer o vínculo.
  UPDATE cupons SET estabelecimento_id = (
    SELECT e.id FROM estabelecimentos e
    WHERE ltrim(e.cnpj, '0') = ltrim(substr(cupons.chave_acesso, 7, 14), '0')
  )
  WHERE EXISTS (
    SELECT 1 FROM estabelecimentos e
    WHERE ltrim(e.cnpj, '0') = ltrim(substr(cupons.chave_acesso, 7, 14), '0')
  );

  -- Produtos de cupons que não existem mais
  DELETE FROM produtos WHERE cupom_id NOT IN (SELECT id FROM cupons);
  `,
];

/**
 * Inicializa o banco de dados e aplica as migrações pendentes
 */
export const initDatabase = async (): Promise<void> => {
  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const versaoAtual = row?.user_version ?? 0;

    for (let versao = versaoAtual; versao < MIGRATIONS.length; versao++) {
      await db.withExclusiveTransactionAsync(async txn => {
        await txn.execAsync(MIGRATIONS[versao]);
        await txn.execAsync(`PRAGMA user_version = ${versao + 1}`);
      });
      console.log(`Migração do banco aplicada: v${versao + 1}`);
    }

    console.log('Banco de dados inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error);
    throw error;
  }
};

/**
 * Obtém a instância do banco de dados
 */
const getDB = (): SQLite.SQLiteDatabase => {
  if (!db) {
    throw new Error('Banco de dados não inicializado. Chame initDatabase() primeiro.');
  }
  return db;
};

/**
 * Insere ou atualiza um estabelecimento e retorna seu id
 */
export const upsertEstabelecimento = async (
  estabelecimento: EstabelecimentoData,
  database: SQLite.SQLiteDatabase = getDB()
): Promise<number> => {
  // RETURNING devolve o id tanto na inserção quanto na atualização.
  // (lastInsertRowId não é atualizado quando o ON CONFLICT faz UPDATE.)
  const row = await database.getFirstAsync<{ id: number }>(
    `INSERT INTO estabelecimentos (nome, cnpj, endereco, cidade, estado)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cnpj) DO UPDATE SET
       nome = excluded.nome,
       endereco = COALESCE(excluded.endereco, endereco),
       cidade = COALESCE(excluded.cidade, cidade),
       estado = COALESCE(excluded.estado, estado)
     RETURNING id`,
    [
      estabelecimento.nome,
      estabelecimento.cnpj,
      estabelecimento.endereco || null,
      estabelecimento.cidade || null,
      estabelecimento.estado || null,
    ]
  );

  if (!row) {
    throw new Error('Não foi possível salvar o estabelecimento');
  }

  return row.id;
};

/**
 * Verifica se um cupom com a chave de acesso já foi salvo
 */
export const cupomExiste = async (chaveAcesso: string): Promise<boolean> => {
  const row = await getDB().getFirstAsync<{ id: number }>(
    'SELECT id FROM cupons WHERE chave_acesso = ?',
    [chaveAcesso]
  );
  return row !== null;
};

/**
 * Insere um cupom completo (estabelecimento + cupom + produtos) numa única transação
 */
export const insertCupom = async (cupomData: CupomData): Promise<number> => {
  let cupomId = 0;

  try {
    await getDB().withExclusiveTransactionAsync(async txn => {
      const estabelecimentoId = await upsertEstabelecimento(cupomData.estabelecimento, txn);

      const cupomResult = await txn.runAsync(
        `INSERT INTO cupons (chave_acesso, qr_code, estabelecimento_id, data, subtotal, desconto_total, total, forma_pagamento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cupomData.chaveAcesso,
          cupomData.qrCode,
          estabelecimentoId,
          cupomData.data,
          cupomData.subtotal,
          cupomData.descontoTotal,
          cupomData.total,
          cupomData.formaPagamento,
        ]
      );

      cupomId = cupomResult.lastInsertRowId;

      const insertProduto = await txn.prepareAsync(
        `INSERT INTO produtos (cupom_id, nome, nome_normalizado, codigo, gtin, preco, quantidade, desconto, preco_final)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      try {
        for (const produto of cupomData.produtos) {
          await insertProduto.executeAsync([
            cupomId,
            produto.nome,
            normalizarChaveNome(produto.nome),
            produto.codigo,
            produto.gtin ?? null,
            produto.preco,
            produto.quantidade,
            produto.desconto,
            produto.precoFinal,
          ]);
        }
      } finally {
        await insertProduto.finalizeAsync();
      }
    });

    console.log(`Cupom inserido com sucesso. ID: ${cupomId}`);
    return cupomId;
  } catch (error) {
    console.error('Erro ao inserir cupom:', error);
    throw error;
  }
};

const mapProduto = (p: ProdutoRow): ProdutoData => ({
  id: p.id,
  nome: p.nome,
  codigo: p.codigo,
  gtin: p.gtin,
  preco: p.preco,
  quantidade: p.quantidade,
  desconto: p.desconto,
  precoFinal: p.preco_final,
  cupomId: p.cupom_id,
});

const mapCupom = (cupom: CupomRow, produtos: ProdutoRow[]): CupomData => ({
  id: cupom.id,
  chaveAcesso: cupom.chave_acesso,
  qrCode: cupom.qr_code,
  estabelecimento: {
    id: cupom.estabelecimento_id,
    nome: cupom.estabelecimento_nome,
    cnpj: cupom.cnpj,
    endereco: cupom.endereco ?? undefined,
    cidade: cupom.cidade ?? undefined,
    estado: cupom.estado ?? undefined,
  },
  produtos: produtos.map(mapProduto),
  data: cupom.data,
  subtotal: cupom.subtotal,
  descontoTotal: cupom.desconto_total,
  total: cupom.total,
  formaPagamento: cupom.forma_pagamento,
});

const CUPOM_SELECT = `
  SELECT c.*, e.nome as estabelecimento_nome, e.cnpj, e.endereco, e.cidade, e.estado
  FROM cupons c
  JOIN estabelecimentos e ON c.estabelecimento_id = e.id`;

/**
 * Busca todos os cupons (duas consultas, independente da quantidade de cupons)
 */
export const getAllCupons = async (): Promise<CupomData[]> => {
  const database = getDB();

  const cupons = await database.getAllAsync<CupomRow>(`${CUPOM_SELECT} ORDER BY c.data DESC`);
  const produtos = await database.getAllAsync<ProdutoRow>(
    'SELECT * FROM produtos ORDER BY cupom_id, id'
  );

  const produtosPorCupom = new Map<number, ProdutoRow[]>();
  for (const produto of produtos) {
    const lista = produtosPorCupom.get(produto.cupom_id);
    if (lista) {
      lista.push(produto);
    } else {
      produtosPorCupom.set(produto.cupom_id, [produto]);
    }
  }

  return cupons.map(cupom => mapCupom(cupom, produtosPorCupom.get(cupom.id) || []));
};

/**
 * Busca cupom por ID
 */
export const getCupomById = async (id: number): Promise<CupomData | null> => {
  const database = getDB();

  const cupom = await database.getFirstAsync<CupomRow>(`${CUPOM_SELECT} WHERE c.id = ?`, [id]);

  if (!cupom) return null;

  const produtos = await database.getAllAsync<ProdutoRow>(
    'SELECT * FROM produtos WHERE cupom_id = ? ORDER BY id',
    [id]
  );

  return mapCupom(cupom, produtos);
};

/**
 * Deleta um cupom e seus produtos
 */
export const deleteCupom = async (id: number): Promise<void> => {
  await getDB().withExclusiveTransactionAsync(async txn => {
    await txn.runAsync('DELETE FROM produtos WHERE cupom_id = ?', [id]);
    await txn.runAsync('DELETE FROM cupons WHERE id = ?', [id]);
  });
};
