import * as SQLite from 'expo-sqlite';
import { CupomData, EstabelecimentoData, ProdutoData } from '../../models/types';

const DB_NAME = 'cupom_favorito.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Inicializa o banco de dados
 */
export const initDatabase = async (): Promise<void> => {
  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);

    // Criar tabela de estabelecimentos
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS estabelecimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cnpj TEXT UNIQUE NOT NULL,
        endereco TEXT,
        cidade TEXT,
        estado TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Criar tabela de cupons
    await db.execAsync(`
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
    `);

    // Criar tabela de produtos
    await db.execAsync(`
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
    `);

    // Criar índices para melhor performance
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_cupons_data ON cupons(data);
      CREATE INDEX IF NOT EXISTS idx_cupons_estabelecimento ON cupons(estabelecimento_id);
      CREATE INDEX IF NOT EXISTS idx_produtos_cupom ON produtos(cupom_id);
      CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome_normalizado);
      CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);
    `);

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
 * Insere ou atualiza um estabelecimento
 */
export const upsertEstabelecimento = async (
  estabelecimento: EstabelecimentoData
): Promise<number> => {
  const database = getDB();

  const result = await database.runAsync(
    `INSERT INTO estabelecimentos (nome, cnpj, endereco, cidade, estado)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cnpj) DO UPDATE SET
       nome = excluded.nome,
       endereco = excluded.endereco,
       cidade = excluded.cidade,
       estado = excluded.estado
     RETURNING id`,
    [
      estabelecimento.nome,
      estabelecimento.cnpj,
      estabelecimento.endereco || null,
      estabelecimento.cidade || null,
      estabelecimento.estado || null,
    ]
  );

  return result.lastInsertRowId;
};

/**
 * Insere um cupom completo (estabelecimento + cupom + produtos)
 */
export const insertCupom = async (cupomData: CupomData): Promise<number> => {
  const database = getDB();

  try {
    // Inserir ou atualizar estabelecimento
    const estabelecimentoId = await upsertEstabelecimento(cupomData.estabelecimento);

    // Inserir cupom
    const cupomResult = await database.runAsync(
      `INSERT INTO cupons (chave_acesso, qr_code, estabelecimento_id, data, subtotal, desconto_total, total, forma_pagamento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
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

    const cupomId = cupomResult.lastInsertRowId;

    // Inserir produtos
    for (const produto of cupomData.produtos) {
      const nomeNormalizado = produto.nome.toLowerCase().trim();

      await database.runAsync(
        `INSERT INTO produtos (cupom_id, nome, nome_normalizado, codigo, preco, quantidade, desconto, preco_final)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cupomId,
          produto.nome,
          nomeNormalizado,
          produto.codigo,
          produto.preco,
          produto.quantidade,
          produto.desconto,
          produto.precoFinal,
        ]
      );
    }

    console.log(`Cupom inserido com sucesso. ID: ${cupomId}`);
    return cupomId;
  } catch (error) {
    console.error('Erro ao inserir cupom:', error);
    throw error;
  }
};

/**
 * Busca todos os cupons
 */
export const getAllCupons = async (): Promise<CupomData[]> => {
  const database = getDB();

  const cupons = await database.getAllAsync<any>(
    `SELECT c.*, e.nome as estabelecimento_nome, e.cnpj, e.endereco, e.cidade, e.estado
     FROM cupons c
     JOIN estabelecimentos e ON c.estabelecimento_id = e.id
     ORDER BY c.data DESC`
  );

  const result: CupomData[] = [];

  for (const cupom of cupons) {
    const produtos = await database.getAllAsync<any>(
      `SELECT * FROM produtos WHERE cupom_id = ?`,
      [cupom.id]
    );

    result.push({
      id: cupom.id,
      chaveAcesso: cupom.chave_acesso,
      qrCode: cupom.qr_code,
      estabelecimento: {
        id: cupom.estabelecimento_id,
        nome: cupom.estabelecimento_nome,
        cnpj: cupom.cnpj,
        endereco: cupom.endereco,
        cidade: cupom.cidade,
        estado: cupom.estado,
      },
      produtos: produtos.map(p => ({
        id: p.id,
        nome: p.nome,
        codigo: p.codigo,
        preco: p.preco,
        quantidade: p.quantidade,
        desconto: p.desconto,
        precoFinal: p.preco_final,
        cupomId: p.cupom_id,
      })),
      data: cupom.data,
      subtotal: cupom.subtotal,
      descontoTotal: cupom.desconto_total,
      total: cupom.total,
      formaPagamento: cupom.forma_pagamento,
    });
  }

  return result;
};

/**
 * Busca cupom por ID
 */
export const getCupomById = async (id: number): Promise<CupomData | null> => {
  const database = getDB();

  const cupom = await database.getFirstAsync<any>(
    `SELECT c.*, e.nome as estabelecimento_nome, e.cnpj, e.endereco, e.cidade, e.estado
     FROM cupons c
     JOIN estabelecimentos e ON c.estabelecimento_id = e.id
     WHERE c.id = ?`,
    [id]
  );

  if (!cupom) return null;

  const produtos = await database.getAllAsync<any>(
    `SELECT * FROM produtos WHERE cupom_id = ?`,
    [id]
  );

  return {
    id: cupom.id,
    chaveAcesso: cupom.chave_acesso,
    qrCode: cupom.qr_code,
    estabelecimento: {
      id: cupom.estabelecimento_id,
      nome: cupom.estabelecimento_nome,
      cnpj: cupom.cnpj,
      endereco: cupom.endereco,
      cidade: cupom.cidade,
      estado: cupom.estado,
    },
    produtos: produtos.map(p => ({
      id: p.id,
      nome: p.nome,
      codigo: p.codigo,
      preco: p.preco,
      quantidade: p.quantidade,
      desconto: p.desconto,
      precoFinal: p.preco_final,
      cupomId: p.cupom_id,
    })),
    data: cupom.data,
    subtotal: cupom.subtotal,
    descontoTotal: cupom.desconto_total,
    total: cupom.total,
    formaPagamento: cupom.forma_pagamento,
  };
};

/**
 * Deleta um cupom
 */
export const deleteCupom = async (id: number): Promise<void> => {
  const database = getDB();

  await database.runAsync(`DELETE FROM produtos WHERE cupom_id = ?`, [id]);
  await database.runAsync(`DELETE FROM cupons WHERE id = ?`, [id]);
};
