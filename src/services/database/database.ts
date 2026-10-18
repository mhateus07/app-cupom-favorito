import * as SQLite from 'expo-sqlite';
import {
  AlertaEnviado,
  AlteracaoSync,
  CupomData,
  EstabelecimentoData,
  ItemListaCompra,
  ListaCompra,
  ProdutoData,
  ProdutoMonitorado,
  TipoSync,
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

  // v6: preferências, nomes corrigidos pelo usuário e alertas de preço configuráveis
  `
  CREATE TABLE IF NOT EXISTS preferencias (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  -- Nome normalizado lido na NFC-e -> nome escolhido pelo usuário
  CREATE TABLE IF NOT EXISTS apelidos_produtos (
    nome_original TEXT PRIMARY KEY,
    nome_corrigido TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS produtos_monitorados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    preco_alvo REAL,
    queda_minima REAL NOT NULL DEFAULT 5,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS alertas_enviados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave TEXT NOT NULL,
    produto TEXT NOT NULL,
    mercado TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    preco REAL NOT NULL,
    preco_referencia REAL NOT NULL,
    enviado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_alertas_chave ON alertas_enviados(chave, cnpj);
  `,

  // v7: sincronização com a conta (fila de alterações e id estável dos itens da lista)
  `
  CREATE TABLE IF NOT EXISTS sync_pendentes (
    tipo TEXT NOT NULL,
    chave TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    PRIMARY KEY (tipo, chave)
  );

  ALTER TABLE itens_lista_compras ADD COLUMN uuid TEXT;
  UPDATE itens_lista_compras SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_itens_lista_uuid ON itens_lista_compras(uuid);
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

const AGORA_ISO = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const ouvintesAlteracao = new Set<() => void>();

/** Avisa quando algo muda nos dados locais (usado para agendar a sincronização) */
export const aoAlterarDados = (ouvinte: () => void): (() => void) => {
  ouvintesAlteracao.add(ouvinte);
  return () => ouvintesAlteracao.delete(ouvinte);
};

const avisarAlteracao = () => ouvintesAlteracao.forEach(ouvinte => ouvinte());

/** Id aleatório de 32 caracteres hexadecimais, gerado pelo próprio SQLite */
const novoUuid = async (database: SQLite.SQLiteDatabase): Promise<string> => {
  const row = await database.getFirstAsync<{ uuid: string }>(
    'SELECT lower(hex(randomblob(16))) AS uuid'
  );
  if (!row) throw new Error('Não foi possível gerar o id do item');
  return row.uuid;
};

/** Marca registros para enviar na próxima sincronização */
const marcarPendente = async (
  database: SQLite.SQLiteDatabase,
  tipo: TipoSync,
  chaves: string[]
): Promise<void> => {
  for (const chave of chaves) {
    await database.runAsync(
      `INSERT INTO sync_pendentes (tipo, chave, atualizado_em) VALUES (?, ?, ${AGORA_ISO})
       ON CONFLICT(tipo, chave) DO UPDATE SET atualizado_em = excluded.atualizado_em`,
      [tipo, chave]
    );
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

/** Correções de nome salvas: nome normalizado lido na NFC-e -> nome escolhido */
export const carregarApelidos = async (
  database: SQLite.SQLiteDatabase = getDB()
): Promise<Map<string, string>> => {
  const rows = await database.getAllAsync<{ nome_original: string; nome_corrigido: string }>(
    'SELECT nome_original, nome_corrigido FROM apelidos_produtos'
  );
  return new Map(rows.map(row => [row.nome_original, row.nome_corrigido]));
};

/**
 * Grava cupom e produtos dentro de uma transação. Com cupomIdExistente, substitui os
 * dados de um cupom já salvo (usado quando chega uma versão de outro aparelho).
 */
const gravarCupom = async (
  txn: SQLite.SQLiteDatabase,
  cupomData: CupomData,
  {
    aplicarApelidos = true,
    cupomIdExistente,
  }: { aplicarApelidos?: boolean; cupomIdExistente?: number } = {}
): Promise<number> => {
  const estabelecimentoId = await upsertEstabelecimento(cupomData.estabelecimento, txn);
  const valores = [
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
  ];

  let cupomId: number;
  if (cupomIdExistente !== undefined) {
    await txn.runAsync(
      `UPDATE cupons SET qr_code = ?, estabelecimento_id = ?, data = ?, subtotal = ?, desconto_total = ?,
         total = ?, forma_pagamento = ?, observacao = ?, favorito = ?, data_importacao = ?
       WHERE id = ?`,
      [...valores, cupomIdExistente]
    );
    await txn.runAsync('DELETE FROM produtos WHERE cupom_id = ?', [cupomIdExistente]);
    cupomId = cupomIdExistente;
  } else {
    const cupomResult = await txn.runAsync(
      `INSERT INTO cupons (chave_acesso, qr_code, estabelecimento_id, data, subtotal, desconto_total, total, forma_pagamento, observacao, favorito, data_importacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cupomData.chaveAcesso, ...valores]
    );
    cupomId = cupomResult.lastInsertRowId;
  }

  const apelidos = aplicarApelidos ? await carregarApelidos(txn) : new Map<string, string>();

  const insertProduto = await txn.prepareAsync(
    `INSERT INTO produtos (cupom_id, nome, nome_normalizado, codigo, gtin, unidade, marca, categoria, preco, quantidade, desconto, preco_final)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  try {
    for (const produto of cupomData.produtos) {
      const nome = apelidos.get(normalizarChaveNome(produto.nome)) ?? produto.nome;
      await insertProduto.executeAsync([
        cupomId,
        nome,
        normalizarChaveNome(nome),
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
  return cupomId;
};

/**
 * Insere um cupom completo (estabelecimento + cupom + produtos) numa única transação
 */
export const insertCupom = async (cupomData: CupomData): Promise<number> => {
  let cupomId = 0;

  try {
    await getDB().withExclusiveTransactionAsync(async txn => {
      cupomId = await gravarCupom(txn, cupomData);
      await marcarPendente(txn, 'cupom', [cupomData.chaveAcesso]);
    });

    console.log(`Cupom inserido com sucesso. ID: ${cupomId}`);
    avisarAlteracao();
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
  await getDB().withExclusiveTransactionAsync(async txn => {
    await txn.runAsync('UPDATE cupons SET observacao = ?, favorito = ? WHERE id = ?', [
      dados.observacao || null,
      dados.favorito ? 1 : 0,
      id,
    ]);
    const cupom = await txn.getFirstAsync<{ chave_acesso: string }>(
      'SELECT chave_acesso FROM cupons WHERE id = ?',
      [id]
    );
    if (cupom) await marcarPendente(txn, 'cupom', [cupom.chave_acesso]);
  });
  avisarAlteracao();
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
    const uuid = await novoUuid(txn);
    await txn.runAsync(
      'INSERT INTO itens_lista_compras (lista_id, nome, quantidade, uuid) VALUES (?, ?, ?, ?)',
      [listaId, limpo, Math.max(0.001, quantidade), uuid]
    );
    await marcarPendente(txn, 'item_lista', [uuid]);
    await txn.runAsync('UPDATE listas_compras SET atualizada_em = CURRENT_TIMESTAMP WHERE id = ?', [
      listaId,
    ]);
  });
  avisarAlteracao();
};

const uuidsDosItens = async (database: SQLite.SQLiteDatabase, where: string, params: number[]) =>
  (
    await database.getAllAsync<{ uuid: string }>(
      `SELECT uuid FROM itens_lista_compras WHERE ${where}`,
      params
    )
  ).map(item => item.uuid);

export const marcarItemLista = async (itemId: number, comprado: boolean): Promise<void> => {
  await getDB().withExclusiveTransactionAsync(async txn => {
    await txn.runAsync('UPDATE itens_lista_compras SET comprado = ? WHERE id = ?', [
      comprado ? 1 : 0,
      itemId,
    ]);
    await marcarPendente(txn, 'item_lista', await uuidsDosItens(txn, 'id = ?', [itemId]));
  });
  avisarAlteracao();
};

export const removerItemLista = async (itemId: number): Promise<void> => {
  await getDB().withExclusiveTransactionAsync(async txn => {
    await marcarPendente(txn, 'item_lista', await uuidsDosItens(txn, 'id = ?', [itemId]));
    await txn.runAsync('DELETE FROM itens_lista_compras WHERE id = ?', [itemId]);
  });
  avisarAlteracao();
};

export const limparItensComprados = async (): Promise<void> => {
  await getDB().withExclusiveTransactionAsync(async txn => {
    await marcarPendente(txn, 'item_lista', await uuidsDosItens(txn, 'comprado = 1', []));
    await txn.runAsync('DELETE FROM itens_lista_compras WHERE comprado = 1');
  });
  avisarAlteracao();
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
    const cupom = await txn.getFirstAsync<{ chave_acesso: string }>(
      'SELECT chave_acesso FROM cupons WHERE id = ?',
      [id]
    );
    if (cupom) await marcarPendente(txn, 'cupom', [cupom.chave_acesso]);
    await txn.runAsync('DELETE FROM produtos WHERE cupom_id = ?', [id]);
    await txn.runAsync('DELETE FROM cupons WHERE id = ?', [id]);
  });
  avisarAlteracao();
};

// ---------------------------------------------------------------------------
// Preferências
// ---------------------------------------------------------------------------

export const getPreferencia = async (chave: string): Promise<string | null> => {
  const row = await getDB().getFirstAsync<{ valor: string }>(
    'SELECT valor FROM preferencias WHERE chave = ?',
    [chave]
  );
  return row?.valor ?? null;
};

export const setPreferencia = async (chave: string, valor: string): Promise<void> => {
  await getDB().runAsync(
    `INSERT INTO preferencias (chave, valor) VALUES (?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
    [chave, valor]
  );
};

// ---------------------------------------------------------------------------
// Correção manual de nomes de produtos
// ---------------------------------------------------------------------------

/**
 * Renomeia todas as compras de um produto e lembra a correção, para que os próximos
 * cupons com o mesmo nome já entrem corrigidos.
 */
export const corrigirNomeProduto = async (nomeAtual: string, nomeNovo: string): Promise<void> => {
  const novo = nomeNovo.trim();
  const original = normalizarChaveNome(nomeAtual);
  if (!novo || !original) return;
  const normalizadoNovo = normalizarChaveNome(novo);

  await getDB().withExclusiveTransactionAsync(async txn => {
    const cupons = await txn.getAllAsync<{ chave_acesso: string }>(
      `SELECT DISTINCT c.chave_acesso FROM cupons c
       JOIN produtos p ON p.cupom_id = c.id WHERE p.nome_normalizado = ?`,
      [original]
    );
    await marcarPendente(
      txn,
      'cupom',
      cupons.map(cupom => cupom.chave_acesso)
    );
    await txn.runAsync(
      'UPDATE produtos SET nome = ?, nome_normalizado = ? WHERE nome_normalizado = ?',
      [novo, normalizadoNovo, original]
    );
    // Apelidos que apontavam para o nome antigo passam a apontar para o novo
    await txn.runAsync(
      'UPDATE apelidos_produtos SET nome_corrigido = ? WHERE lower(nome_corrigido) = lower(?)',
      [novo, nomeAtual.trim()]
    );
    if (original !== normalizadoNovo) {
      await txn.runAsync(
        `INSERT INTO apelidos_produtos (nome_original, nome_corrigido) VALUES (?, ?)
         ON CONFLICT(nome_original) DO UPDATE SET nome_corrigido = excluded.nome_corrigido`,
        [original, novo]
      );
    }
    await txn.runAsync('DELETE FROM apelidos_produtos WHERE nome_original = ?', [normalizadoNovo]);
    const apelidos = await txn.getAllAsync<{ nome_original: string }>(
      'SELECT nome_original FROM apelidos_produtos WHERE nome_corrigido = ?',
      [novo]
    );
    await marcarPendente(txn, 'apelido', [
      normalizadoNovo,
      ...apelidos.map(apelido => apelido.nome_original),
    ]);
  });
  avisarAlteracao();
};

/** Grava as correções feitas na revisão do cupom (nome lido -> nome escolhido) */
export const salvarApelidos = async (
  correcoes: Array<{ original: string; corrigido: string }>
): Promise<void> => {
  const validas = correcoes.filter(
    c => c.corrigido.trim() && normalizarChaveNome(c.original) !== normalizarChaveNome(c.corrigido)
  );
  if (validas.length === 0) return;
  await getDB().withExclusiveTransactionAsync(async txn => {
    for (const { original, corrigido } of validas) {
      await txn.runAsync(
        `INSERT INTO apelidos_produtos (nome_original, nome_corrigido) VALUES (?, ?)
         ON CONFLICT(nome_original) DO UPDATE SET nome_corrigido = excluded.nome_corrigido`,
        [normalizarChaveNome(original), corrigido.trim()]
      );
    }
    await marcarPendente(
      txn,
      'apelido',
      validas.map(({ original }) => normalizarChaveNome(original))
    );
  });
  avisarAlteracao();
};

// ---------------------------------------------------------------------------
// Produtos monitorados e alertas enviados
// ---------------------------------------------------------------------------

export const getProdutosMonitorados = async (): Promise<ProdutoMonitorado[]> => {
  const rows = await getDB().getAllAsync<{
    id: number;
    chave: string;
    nome: string;
    preco_alvo: number | null;
    queda_minima: number;
  }>('SELECT id, chave, nome, preco_alvo, queda_minima FROM produtos_monitorados ORDER BY nome');
  return rows.map(row => ({
    id: row.id,
    chave: row.chave,
    nome: row.nome,
    precoAlvo: row.preco_alvo,
    quedaMinima: row.queda_minima,
  }));
};

export const salvarProdutoMonitorado = async (
  produto: Omit<ProdutoMonitorado, 'id'>
): Promise<void> => {
  await getDB().withExclusiveTransactionAsync(async txn => {
    await gravarMonitorado(txn, produto);
    await marcarPendente(txn, 'monitorado', [produto.chave]);
  });
  avisarAlteracao();
};

const gravarMonitorado = async (
  database: SQLite.SQLiteDatabase,
  produto: Omit<ProdutoMonitorado, 'id'>
): Promise<void> => {
  await database.runAsync(
    `INSERT INTO produtos_monitorados (chave, nome, preco_alvo, queda_minima) VALUES (?, ?, ?, ?)
     ON CONFLICT(chave) DO UPDATE SET
       nome = excluded.nome,
       preco_alvo = excluded.preco_alvo,
       queda_minima = excluded.queda_minima`,
    [produto.chave, produto.nome, produto.precoAlvo, produto.quedaMinima]
  );
};

export const removerPreferencia = async (chave: string): Promise<void> => {
  await getDB().runAsync('DELETE FROM preferencias WHERE chave = ?', [chave]);
};

export const removerProdutoMonitorado = async (id: number): Promise<void> => {
  await getDB().withExclusiveTransactionAsync(async txn => {
    const produto = await txn.getFirstAsync<{ chave: string }>(
      'SELECT chave FROM produtos_monitorados WHERE id = ?',
      [id]
    );
    if (produto) await marcarPendente(txn, 'monitorado', [produto.chave]);
    await txn.runAsync('DELETE FROM produtos_monitorados WHERE id = ?', [id]);
  });
  avisarAlteracao();
};

export const getAlertasEnviados = async (limite = 100): Promise<AlertaEnviado[]> => {
  const rows = await getDB().getAllAsync<{
    id: number;
    chave: string;
    produto: string;
    mercado: string;
    cnpj: string;
    preco: number;
    preco_referencia: number;
    enviado_em: string;
  }>('SELECT * FROM alertas_enviados ORDER BY enviado_em DESC, id DESC LIMIT ?', [limite]);
  return rows.map(row => ({
    id: row.id,
    chave: row.chave,
    produto: row.produto,
    mercado: row.mercado,
    cnpj: row.cnpj,
    preco: row.preco,
    precoReferencia: row.preco_referencia,
    enviadoEm: row.enviado_em,
  }));
};

export const registrarAlertasEnviados = async (
  alertas: Array<Omit<AlertaEnviado, 'id' | 'enviadoEm'>>
): Promise<void> => {
  if (alertas.length === 0) return;
  await getDB().withExclusiveTransactionAsync(async txn => {
    for (const alerta of alertas) {
      await txn.runAsync(
        `INSERT INTO alertas_enviados (chave, produto, mercado, cnpj, preco, preco_referencia, enviado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          alerta.chave,
          alerta.produto,
          alerta.mercado,
          alerta.cnpj,
          alerta.preco,
          alerta.precoReferencia,
          new Date().toISOString(),
        ]
      );
    }
  });
};

// ---------------------------------------------------------------------------
// Sincronização com a conta
// ---------------------------------------------------------------------------

/** Marca todos os dados locais para envio (ao entrar na conta neste aparelho) */
export const enfileirarTudo = async (): Promise<void> => {
  await getDB().withExclusiveTransactionAsync(async txn => {
    const inserir = (tipo: TipoSync, select: string) =>
      txn.runAsync(
        `INSERT INTO sync_pendentes (tipo, chave, atualizado_em)
         SELECT '${tipo}', chave, ${AGORA_ISO} FROM (${select})
         WHERE true ON CONFLICT(tipo, chave) DO NOTHING`
      );
    await inserir('cupom', 'SELECT chave_acesso AS chave FROM cupons');
    await inserir('item_lista', 'SELECT uuid AS chave FROM itens_lista_compras');
    await inserir('monitorado', 'SELECT chave FROM produtos_monitorados');
    await inserir('apelido', 'SELECT nome_original AS chave FROM apelidos_produtos');
  });
};

/** Esquece a fila (ao sair da conta: o que não foi enviado fica só neste aparelho) */
export const limparFilaSync = async (): Promise<void> => {
  await getDB().runAsync('DELETE FROM sync_pendentes');
};

/** Os ids locais não vão para o servidor: cada aparelho tem os seus (JSON ignora undefined) */
const semIds = (cupom: CupomData): CupomData => ({
  ...cupom,
  id: undefined,
  estabelecimento: { ...cupom.estabelecimento, id: undefined },
  produtos: cupom.produtos.map(produto => ({ ...produto, id: undefined, cupomId: undefined })),
});

/** Lê as alterações pendentes já com o estado atual de cada registro */
export const lerPendentes = async (limite = 500): Promise<AlteracaoSync[]> => {
  const database = getDB();
  const pendentes = await database.getAllAsync<{
    tipo: TipoSync;
    chave: string;
    atualizado_em: string;
  }>('SELECT tipo, chave, atualizado_em FROM sync_pendentes ORDER BY atualizado_em LIMIT ?', [
    limite,
  ]);

  const alteracoes: AlteracaoSync[] = [];
  for (const { tipo, chave, atualizado_em: atualizadoEm } of pendentes) {
    let dados: unknown = null;
    if (tipo === 'cupom') {
      const row = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM cupons WHERE chave_acesso = ?',
        [chave]
      );
      const cupom = row ? await getCupomById(row.id) : null;
      dados = cupom ? semIds(cupom) : null;
    } else if (tipo === 'item_lista') {
      const item = await database.getFirstAsync<{
        nome: string;
        quantidade: number;
        comprado: number;
        gtin: string | null;
      }>('SELECT nome, quantidade, comprado, gtin FROM itens_lista_compras WHERE uuid = ?', [
        chave,
      ]);
      dados = item ? { ...item, comprado: item.comprado === 1 } : null;
    } else if (tipo === 'monitorado') {
      const produto = await database.getFirstAsync<{
        nome: string;
        preco_alvo: number | null;
        queda_minima: number;
      }>('SELECT nome, preco_alvo, queda_minima FROM produtos_monitorados WHERE chave = ?', [
        chave,
      ]);
      dados = produto
        ? { nome: produto.nome, precoAlvo: produto.preco_alvo, quedaMinima: produto.queda_minima }
        : null;
    } else if (tipo === 'apelido') {
      const apelido = await database.getFirstAsync<{ nome_corrigido: string }>(
        'SELECT nome_corrigido FROM apelidos_produtos WHERE nome_original = ?',
        [chave]
      );
      dados = apelido ? { nomeCorrigido: apelido.nome_corrigido } : null;
    }
    alteracoes.push({ tipo, chave, dados, excluido: dados === null, atualizadoEm });
  }
  return alteracoes;
};

/** Tira da fila o que foi enviado, se não mudou de novo enquanto a requisição estava no ar */
export const confirmarEnviados = async (enviados: AlteracaoSync[]): Promise<void> => {
  await getDB().withExclusiveTransactionAsync(async txn => {
    for (const { tipo, chave, atualizadoEm } of enviados) {
      await txn.runAsync(
        'DELETE FROM sync_pendentes WHERE tipo = ? AND chave = ? AND atualizado_em = ?',
        [tipo, chave, atualizadoEm]
      );
    }
  });
};

/**
 * Aplica o que veio do servidor. Não entra na fila (já está no servidor) e ignora o
 * registro quando há uma alteração local mais nova ainda não enviada.
 */
export const aplicarAlteracoesRemotas = async (alteracoes: AlteracaoSync[]): Promise<number> => {
  if (alteracoes.length === 0) return 0;
  let aplicadas = 0;
  // Fora da transação: usa a conexão principal
  const listaId = await obterOuCriarListaPadrao();

  await getDB().withExclusiveTransactionAsync(async txn => {
    for (const alteracao of alteracoes) {
      const { tipo, chave, excluido } = alteracao;
      const pendente = await txn.getFirstAsync<{ atualizado_em: string }>(
        'SELECT atualizado_em FROM sync_pendentes WHERE tipo = ? AND chave = ?',
        [tipo, chave]
      );
      if (pendente && pendente.atualizado_em > alteracao.atualizadoEm) continue;

      if (tipo === 'cupom') {
        const existente = await txn.getFirstAsync<{ id: number }>(
          'SELECT id FROM cupons WHERE chave_acesso = ?',
          [chave]
        );
        if (excluido) {
          if (existente) {
            await txn.runAsync('DELETE FROM produtos WHERE cupom_id = ?', [existente.id]);
            await txn.runAsync('DELETE FROM cupons WHERE id = ?', [existente.id]);
          }
        } else {
          await gravarCupom(
            txn,
            { ...(alteracao.dados as CupomData), chaveAcesso: chave },
            {
              aplicarApelidos: false,
              cupomIdExistente: existente?.id,
            }
          );
        }
      } else if (tipo === 'item_lista') {
        if (excluido) {
          await txn.runAsync('DELETE FROM itens_lista_compras WHERE uuid = ?', [chave]);
        } else {
          const item = alteracao.dados as Pick<
            ItemListaCompra,
            'nome' | 'quantidade' | 'comprado' | 'gtin'
          >;
          await txn.runAsync(
            `INSERT INTO itens_lista_compras (lista_id, nome, quantidade, comprado, gtin, uuid)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(uuid) DO UPDATE SET
               nome = excluded.nome, quantidade = excluded.quantidade,
               comprado = excluded.comprado, gtin = excluded.gtin`,
            [listaId, item.nome, item.quantidade, item.comprado ? 1 : 0, item.gtin ?? null, chave]
          );
        }
      } else if (tipo === 'monitorado') {
        if (excluido) {
          await txn.runAsync('DELETE FROM produtos_monitorados WHERE chave = ?', [chave]);
        } else {
          const produto = alteracao.dados as Omit<ProdutoMonitorado, 'id' | 'chave'>;
          await gravarMonitorado(txn, { ...produto, chave });
        }
      } else if (tipo === 'apelido') {
        if (excluido) {
          await txn.runAsync('DELETE FROM apelidos_produtos WHERE nome_original = ?', [chave]);
        } else {
          await txn.runAsync(
            `INSERT INTO apelidos_produtos (nome_original, nome_corrigido) VALUES (?, ?)
             ON CONFLICT(nome_original) DO UPDATE SET nome_corrigido = excluded.nome_corrigido`,
            [chave, (alteracao.dados as { nomeCorrigido: string }).nomeCorrigido]
          );
        }
      }
      if (pendente) {
        await txn.runAsync('DELETE FROM sync_pendentes WHERE tipo = ? AND chave = ?', [
          tipo,
          chave,
        ]);
      }
      aplicadas++;
    }
  });
  return aplicadas;
};
