const express = require('express');
const { db } = require('../db');
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

router.post('/', async (req, res) => {
  const { nome, endereco, telefone } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
  }

  const resultado = await db.run(
    'INSERT INTO clientes (nome, endereco, telefone) VALUES (?, ?, ?)',
    String(nome).trim(),
    endereco ? String(endereco).trim() : null,
    telefone ? String(telefone).trim() : null
  );

  const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', resultado.lastInsertRowid);
  return res.status(201).json(normalizarCliente(cliente));
});

router.get('/', async (req, res) => {
  const { busca } = req.query;
  let linhas;
  if (busca) {
    linhas = await db.all(
      `SELECT * FROM clientes
       WHERE nome LIKE ? OR telefone LIKE ? OR endereco LIKE ?
       ORDER BY nome`,
      `%${busca}%`,
      `%${busca}%`,
      `%${busca}%`
    );
  } else {
    linhas = await db.all('SELECT * FROM clientes ORDER BY nome');
  }
  return res.json(linhas.map(normalizarCliente));
});

router.get('/:id', async (req, res) => {
  const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', req.params.id);
  if (!cliente) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' });
  }
  return res.json(normalizarCliente(cliente));
});

router.put('/:id', async (req, res) => {
  const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', req.params.id);
  if (!cliente) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' });
  }

  const { nome, endereco, telefone } = req.body || {};

  const novoNome = nome !== undefined ? String(nome).trim() : cliente.nome;
  if (!novoNome) {
    return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
  }

  await db.run(
    `UPDATE clientes
     SET nome = ?, endereco = ?, telefone = ?, atualizado_em = datetime('now', 'localtime')
     WHERE id = ?`,
    novoNome,
    endereco !== undefined ? String(endereco).trim() || null : cliente.endereco,
    telefone !== undefined ? String(telefone).trim() || null : cliente.telefone,
    cliente.id
  );

  const atualizado = await db.get('SELECT * FROM clientes WHERE id = ?', cliente.id);
  return res.json(normalizarCliente(atualizado));
});

router.delete('/:id', async (req, res) => {
  const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', req.params.id);
  if (!cliente) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' });
  }
  await db.run('DELETE FROM clientes WHERE id = ?', cliente.id);
  return res.status(204).send();
});

module.exports = router;
