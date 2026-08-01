const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'database.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrar() {
  db.exec(`
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
  `);
}

migrar();

module.exports = db;
