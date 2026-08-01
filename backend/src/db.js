const path = require('path');
const { createClient } = require('@libsql/client');

const usaTurso = Boolean(process.env.TURSO_URL && process.env.TURSO_TOKEN);

let local;

function criarOpsLocal() {
  return {
    run(sql, ...params) {
      return local.prepare(sql).run(...params);
    },
    get(sql, ...params) {
      return local.prepare(sql).get(...params);
    },
    all(sql, ...params) {
      return local.prepare(sql).all(...params);
    },
    exec(sql) {
      local.exec(sql);
    },
  };
}

function criarOpsTurso(executor) {
  return {
    async run(sql, ...params) {
      const r = await executor({ sql, args: params });
      return { changes: r.rowCount, lastInsertRowid: Number(r.lastInsertRowid) };
    },
    async get(sql, ...params) {
      const r = await executor({ sql, args: params });
      return r.rows[0] ?? null;
    },
    async all(sql, ...params) {
      const r = await executor({ sql, args: params });
      return r.rows;
    },
    async exec(sql) {
      await executor({ sql, args: [] });
    },
  };
}

let ops;
let remoto;

if (usaTurso) {
  remoto = createClient({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_TOKEN,
  });
  ops = criarOpsTurso(({ sql, args }) => remoto.execute({ sql, args }));
} else {
  const Database = require('better-sqlite3');
  local = new Database(path.join(__dirname, '..', 'database.db'));
  local.pragma('journal_mode = WAL');
  local.pragma('foreign_keys = ON');
  ops = criarOpsLocal();
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco_custo REAL NOT NULL DEFAULT 0,
    margem_percentual REAL NOT NULL DEFAULT 0,
    preco_venda REAL NOT NULL DEFAULT 0,
    estoque INTEGER NOT NULL DEFAULT 0,
    foto TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    atualizado_em TEXT
  );

  CREATE TABLE IF NOT EXISTS movimentos_estoque (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    quantidade INTEGER NOT NULL,
    custo_unitario REAL,
    observacao TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    endereco TEXT,
    telefone TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    atualizado_em TEXT
  );

  CREATE TABLE IF NOT EXISTS vendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    tipo TEXT NOT NULL DEFAULT 'venda' CHECK (tipo IN ('venda', 'encomenda')),
    forma_pagamento TEXT NOT NULL DEFAULT 'a_vista' CHECK (forma_pagamento IN ('a_vista', 'parcelado')),
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada')),
    criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS venda_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venda_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario REAL NOT NULL,
    custo_unitario REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  );

  CREATE TABLE IF NOT EXISTS parcelas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venda_id INTEGER NOT NULL,
    numero INTEGER NOT NULL,
    valor REAL NOT NULL,
    data_vencimento TEXT NOT NULL,
    pago INTEGER NOT NULL DEFAULT 0,
    data_pagamento TEXT,
    FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE
  );
`;

async function migrar() {
  if (usaTurso) {
    await remoto.executeMultiple(SCHEMA);
  } else {
    local.exec(SCHEMA);
  }
}

const db = {
  ...ops,
  usandoTurso: usaTurso,

  async transacao(fn) {
    if (usaTurso) {
      const tx = await remoto.transaction();
      try {
        const resultado = await fn(criarOpsTurso(({ sql, args }) => tx.execute({ sql, args })));
        await tx.commit();
        return resultado;
      } catch (erro) {
        try {
          await tx.rollback();
        } catch {}
        throw erro;
      }
    }

    local.exec('BEGIN IMMEDIATE');
    try {
      const resultado = await fn(criarOpsLocal());
      local.exec('COMMIT');
      return resultado;
    } catch (erro) {
      try {
        local.exec('ROLLBACK');
      } catch {}
      throw erro;
    }
  },
};

module.exports = { db, migrar };
