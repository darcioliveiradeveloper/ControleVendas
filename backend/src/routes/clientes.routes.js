const express = require('express');
const Cliente = require('../models/Cliente');
const autenticar = require('../middleware/auth');
const { proximoId } = require('../ids');
const { agoraLocal } = require('../utilidades');

const router = express.Router();

router.use(autenticar);

function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.post('/', async (req, res) => {
  const { nome, endereco, telefone } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
  }

  const cliente = await Cliente.create({
    _id: await proximoId('clientes'),
    nome: String(nome).trim(),
    endereco: endereco ? String(endereco).trim() : null,
    telefone: telefone ? String(telefone).trim() : null,
    criado_em: agoraLocal(),
  });

  return res.status(201).json(cliente);
});

router.get('/', async (req, res) => {
  const { busca } = req.query;
  let filtro = {};
  if (busca) {
    const regex = new RegExp(escaparRegex(busca), 'i');
    filtro = { $or: [{ nome: regex }, { telefone: regex }, { endereco: regex }] };
  }
  const linhas = await Cliente.find(filtro).sort({ nome: 1 });
  return res.json(linhas);
});

router.get('/:id', async (req, res) => {
  const cliente = await Cliente.findById(Number(req.params.id));
  if (!cliente) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' });
  }
  return res.json(cliente);
});

router.put('/:id', async (req, res) => {
  const cliente = await Cliente.findById(Number(req.params.id));
  if (!cliente) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' });
  }

  const { nome, endereco, telefone } = req.body || {};

  const novoNome = nome !== undefined ? String(nome).trim() : cliente.nome;
  if (!novoNome) {
    return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
  }

  cliente.nome = novoNome;
  cliente.endereco = endereco !== undefined ? String(endereco).trim() || null : cliente.endereco;
  cliente.telefone = telefone !== undefined ? String(telefone).trim() || null : cliente.telefone;
  cliente.atualizado_em = agoraLocal();
  await cliente.save();

  return res.json(cliente);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const cliente = await Cliente.findById(id);
  if (!cliente) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' });
  }
  await Cliente.deleteOne({ _id: id });
  return res.status(204).send();
});

module.exports = router;
