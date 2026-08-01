const express = require('express');
const db = require('../db');
const autenticar = require('../middleware/auth');

const router = express.Router();

router.use(autenticar);

function normalizarCliente(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    endereco: linha.endereco,
    telefone: linha.telefone,
    criado_em: linha.criado_em,
    atualizado_em: linha.atualizado_em,
  };
}

router.post('/', (req, res) => {
  const { nome, endereco, telefone } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
  }

  const resultado = db
    .prepare('INSERT INTO clientes (nome, endereco, telefone) VALUES (?, ?, ?)')
    .run(
      String(nome).trim(),
      endereco ? String(endereco).trim() : null,
      telefone ? String(telefone).trim() : null
    );

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(resultado.lastInsertRowid);
  return res.status(201).json(normalizarCliente(cliente));
});

router.get('/', (req, res) => {
  const { busca } = req.query;
  let linhas;
  if (busca) {
    linhas = db
      .prepare(
        `SELECT * FROM clientes
         WHERE nome LIKE ? OR telefone LIKE ? OR endereco LIKE ?
         ORDER BY nome`
      )
      .all(`%${busca}%`, `%${busca}%`, `%${busca}%`);
  } else {
    linhas = db.prepare('SELECT * FROM clientes ORDER BY nome').all();
  }
  return res.json(linhas.map(normalizarCliente));
});

router.get('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' });
  }
  return res.json(normalizarCliente(cliente));
});

router.put('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' });
  }

  const { nome, endereco, telefone } = req.body || {};

  const novoNome = nome !== undefined ? String(nome).trim() : cliente.nome;
  if (!novoNome) {
    return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
  }

  db.prepare(
    `UPDATE clientes
     SET nome = ?, endereco = ?, telefone = ?, atualizado_em = datetime('now', 'localtime')
     WHERE id = ?`
  ).run(
    novoNome,
    endereco !== undefined ? String(endereco).trim() || null : cliente.endereco,
    telefone !== undefined ? String(telefone).trim() || null : cliente.telefone,
    cliente.id
  );

  const atualizado = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente.id);
  return res.json(normalizarCliente(atualizado));
});

router.delete('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' });
  }
  db.prepare('DELETE FROM clientes WHERE id = ?').run(cliente.id);
  return res.status(204).send();
});

module.exports = router;
