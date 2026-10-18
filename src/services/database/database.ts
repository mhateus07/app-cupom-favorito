import * as SQLite from 'expo-sqlite';
import {
  CupomData,
  EstabelecimentoData,
  ItemListaCompra,
  ListaCompra,
  ProdutoData,
} from '../../models/types';
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
  observacao: string | null;
  favorito: number;
  data_importacao: string | null;
  estabelecimento_nome: string;
  cnpj: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface ProdutoRow {
  id: number;
  cupom_id: number;
  nome: string;
  codigo: string;
  gtin: string | null;
  unidade: string | null;
  marca: string | null;
  categoria: string | null;
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

  // v3: metadados para comparação, organização e edição pelo usuário
  `
  ALTER TABLE produtos ADD COLUMN unidade TEXT;
  ALTER TABLE produtos ADD COLUMN marca TEXT;
  ALTER TABLE produtos ADD COLUMN categoria TEXT;
  ALTER TABLE cupons ADD COLUMN observacao TEXT;
  ALTER TABLE cupons ADD COLUMN favorito INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE cupons ADD COLUMN data_importacao TEXT;
  UPDATE cupons SET data_importacao = COALESCE(data_importacao, created_at);
  `,

  // v4: lista de compras local
  `
  CREATE TABLE IF NOT EXISTS listas_compras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS itens_lista_compras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lista_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    quantidade REAL NOT NULL DEFAULT 1,
    comprado INTEGER NOT NULL DEFAULT 0,
    gtin TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lista_id) REFERENCES listas_compras (id)
  );

  CREATE INDEX IF NOT EXISTS idx_itens_lista_lista ON itens_lista_compras(lista_id);
  `,

  // v5: coordenadas opcionais para recomendações por proximidade
  `
  ALTER TABLE estabelecimentos ADD COLUMN latitude REAL;
  ALTER TABLE estabelecimentos ADD COLUMN longitude REAL;
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
    `INSERT INTO estabelecimentos (nome, cnpj, endereco, cidade, estado, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cnpj) DO UPDATE SET
       nome = excluded.nome,
       endereco = COALESCE(excluded.endereco, endereco),
       cidade = COALESCE(excluded.cidade, cidade),
       estado = COALESCE(excluded.estado, estado),
       latitude = COALESCE(excluded.latitude, latitude),
       longitude = COALESCE(excluded.longitude, longitude)
     RETURNING id`,
    [
      estabelecimento.nome,
      estabelecimento.cnpj,
      estabelecimento.endereco || null,
      estabelecimento.cidade || null,
      estabelecimento.estado || null,
      estabelecimento.latitude ?? null,
      estabelecimento.longitude ?? null,
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
        `INSERT INTO cupons (chave_acesso, qr_code, estabelecimento_id, data, subtotal, desconto_total, total, forma_pagamento, observacao, favorito, data_importacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cupomData.chaveAcesso,
          cupomData.qrCode,
          estabelecimentoId,
          cupomData.data,
          cupomData.subtotal,
          cupomData.descontoTotal,
          cupomData.total,
          cupomData.formaPagamento,
          cupomData.observacao || null,
          cupomData.favorito ? 1 : 0,
          cupomData.dataImportacao || new Date().toISOString(),
        ]
      );

      cupomId = cupomResult.lastInsertRowId;

      const insertProduto = await txn.prepareAsync(
        `INSERT INTO produtos (cupom_id, nome, nome_normalizado, codigo, gtin, unidade, marca, categoria, preco, quantidade, desconto, preco_final)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      try {
        for (const produto of cupomData.produtos) {
          await insertProduto.executeAsync([
            cupomId,
            produto.nome,
            normalizarChaveNome(produto.nome),
            produto.codigo,
            produto.gtin ?? null,
            produto.unidade ?? null,
            produto.marca ?? null,
            produto.categoria ?? null,
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

export const importarCupons = async (
  cupons: CupomData[]
): Promise<{ importados: number; ignorados: number }> => {
  let importados = 0;
  let ignorados = 0;
  for (const cupom of cupons) {
    if (await cupomExiste(cupom.chaveAcesso)) {
      ignorados++;
      continue;
    }
    await insertCupom(cupom);
    importados++;
  }
  return { importados, ignorados };
};

const mapProduto = (p: ProdutoRow): ProdutoData => ({
  id: p.id,
  nome: p.nome,
  codigo: p.codigo,
  gtin: p.gtin,
  unidade: p.unidade ?? undefined,
  marca: p.marca ?? undefined,
  categoria: p.categoria ?? undefined,
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
    latitude: cupom.latitude ?? undefined,
    longitude: cupom.longitude ?? undefined,
  },
  produtos: produtos.map(mapProduto),
  data: cupom.data,
  subtotal: cupom.subtotal,
  descontoTotal: cupom.desconto_total,
  total: cupom.total,
  formaPagamento: cupom.forma_pagamento,
  observacao: cupom.observacao ?? undefined,
  favorito: cupom.favorito === 1,
  dataImportacao: cupom.data_importacao ?? undefined,
});

const CUPOM_SELECT = `
  SELECT c.*, e.nome as estabelecimento_nome, e.cnpj, e.endereco, e.cidade, e.estado,
    e.latitude, e.longitude
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
 * Busca uma página de cupons diretamente no SQLite. Produtos são carregados apenas
 * para os cupons retornados, evitando trazer todo o histórico para cada pesquisa.
 */
export const getCupons = async (
  filtros: import('../../models/types').FiltroData = {}
): Promise<CupomData[]> => {
  const database = getDB();
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filtros.termo?.trim()) {
    const termo = `%${normalizarChaveNome(filtros.termo)}%`;
    const termoCodigo = `%${filtros.termo.trim()}%`;
    where.push(
      `(lower(e.nome) LIKE lower(?) OR EXISTS (
        SELECT 1 FROM produtos p
        WHERE p.cupom_id = c.id
          AND (p.nome_normalizado LIKE ? OR p.codigo LIKE ? OR COALESCE(p.gtin, '') LIKE ?)
      ))`
    );
    params.push(`%${filtros.termo.trim()}%`, termo, termoCodigo, termoCodigo);
  }
  if (filtros.estabelecimento?.trim()) {
    where.push('lower(e.nome) LIKE lower(?)');
    params.push(`%${filtros.estabelecimento.trim()}%`);
  }
  if (filtros.dataInicio) {
    where.push('c.data >= ?');
    params.push(filtros.dataInicio);
  }
  if (filtros.dataFim) {
    where.push('c.data <= ?');
    params.push(filtros.dataFim);
  }
  if (filtros.precoMinimo !== undefined) {
    where.push('c.total >= ?');
    params.push(filtros.precoMinimo);
  }
  if (filtros.precoMaximo !== undefined) {
    where.push('c.total <= ?');
    params.push(filtros.precoMaximo);
  }

  const ordem = {
    data_desc: 'c.data DESC',
    data_asc: 'c.data ASC',
    valor_desc: 'c.total DESC',
    valor_asc: 'c.total ASC',
  }[filtros.ordem || 'data_desc'];
  const limite = filtros.limite ?? 50;
  const offset = filtros.offset ?? 0;
  const sql = `${CUPOM_SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${ordem}, c.id DESC LIMIT ? OFFSET ?`;
  const cupons = await database.getAllAsync<CupomRow>(sql, [...params, limite, offset]);
  if (cupons.length === 0) return [];

  const ids = cupons.map(cupom => cupom.id);
  const placeholders = ids.map(() => '?').join(',');
  const produtos = await database.getAllAsync<ProdutoRow>(
    `SELECT * FROM produtos WHERE cupom_id IN (${placeholders}) ORDER BY cupom_id, id`,
    ids
  );
  const produtosPorCupom = new Map<number, ProdutoRow[]>();
  for (const produto of produtos) {
    const lista = produtosPorCupom.get(produto.cupom_id);
    if (lista) lista.push(produto);
    else produtosPorCupom.set(produto.cupom_id, [produto]);
  }
  return cupons.map(cupom => mapCupom(cupom, produtosPorCupom.get(cupom.id) || []));
};

export const atualizarCupom = async (
  id: number,
  dados: Pick<CupomData, 'observacao' | 'favorito'>
): Promise<void> => {
  await getDB().runAsync('UPDATE cupons SET observacao = ?, favorito = ? WHERE id = ?', [
    dados.observacao || null,
    dados.favorito ? 1 : 0,
    id,
  ]);
};

export const atualizarCoordenadasEstabelecimento = async (
  cnpj: string,
  latitude: number,
  longitude: number
): Promise<void> => {
  await getDB().runAsync('UPDATE estabelecimentos SET latitude = ?, longitude = ? WHERE cnpj = ?', [
    latitude,
    longitude,
    cnpj,
  ]);
};

const NOME_LISTA_PADRAO = 'Minha lista';

const obterOuCriarListaPadrao = async (): Promise<number> => {
  const database = getDB();
  const existente = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM listas_compras ORDER BY id LIMIT 1'
  );
  if (existente) return existente.id;
  const criada = await database.runAsync('INSERT INTO listas_compras (nome) VALUES (?)', [
    NOME_LISTA_PADRAO,
  ]);
  return criada.lastInsertRowId;
};

export const getListaPadrao = async (): Promise<ListaCompra> => {
  const database = getDB();
  const listaId = await obterOuCriarListaPadrao();
  const lista = await database.getFirstAsync<{ id: number; nome: string }>(
    'SELECT id, nome FROM listas_compras WHERE id = ?',
    [listaId]
  );
  if (!lista) throw new Error('Não foi possível carregar a lista de compras');
  const itens = await database.getAllAsync<{
    id: number;
    lista_id: number;
    nome: string;
    quantidade: number;
    comprado: number;
    gtin: string | null;
  }>(
    'SELECT id, lista_id, nome, quantidade, comprado, gtin FROM itens_lista_compras WHERE lista_id = ? ORDER BY comprado, id',
    [listaId]
  );
  return {
    id: lista.id,
    nome: lista.nome,
    itens: itens.map<ItemListaCompra>(item => ({
      id: item.id,
      listaId: item.lista_id,
      nome: item.nome,
      quantidade: item.quantidade,
      comprado: item.comprado === 1,
      gtin: item.gtin,
    })),
  };
};

export const adicionarItemLista = async (nome: string, quantidade = 1): Promise<void> => {
  const limpo = nome.trim();
  if (!limpo) return;
  const listaId = await obterOuCriarListaPadrao();
  await getDB().withExclusiveTransactionAsync(async txn => {
    await txn.runAsync(
      'INSERT INTO itens_lista_compras (lista_id, nome, quantidade) VALUES (?, ?, ?)',
      [listaId, limpo, Math.max(0.001, quantidade)]
    );
    await txn.runAsync('UPDATE listas_compras SET atualizada_em = CURRENT_TIMESTAMP WHERE id = ?', [
      listaId,
    ]);
  });
};

export const marcarItemLista = async (itemId: number, comprado: boolean): Promise<void> => {
  await getDB().runAsync('UPDATE itens_lista_compras SET comprado = ? WHERE id = ?', [
    comprado ? 1 : 0,
    itemId,
  ]);
};

export const removerItemLista = async (itemId: number): Promise<void> => {
  await getDB().runAsync('DELETE FROM itens_lista_compras WHERE id = ?', [itemId]);
};

export const limparItensComprados = async (): Promise<void> => {
  await getDB().runAsync('DELETE FROM itens_lista_compras WHERE comprado = 1');
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
