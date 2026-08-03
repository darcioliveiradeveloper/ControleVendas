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
  const { nome, telefone, whatsapp, email, data_nascimento } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
  }

  const cliente = await Cliente.create({
    _id: await proximoId('clientes'),
    nome: String(nome).trim(),
    telefone: telefone ? String(telefone).trim() : null,
    whatsapp: whatsapp ? String(whatsapp).trim() : null,
    email: email ? String(email).trim() : null,
    data_nascimento: data_nascimento ? String(data_nascimento).trim() : null,
    criado_em: agoraLocal(),
  });

  return res.status(201).json(cliente);
});

router.get('/', async (req, res) => {
  const { busca } = req.query;
  let filtro = {};
  if (busca) {
    const regex = new RegExp(escaparRegex(busca), 'i');
    filtro = { $or: [{ nome: regex }, { telefone: regex }, { whatsapp: regex }, { email: regex }] };
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

  const { nome, telefone, whatsapp, email, data_nascimento } = req.body || {};

  const novoNome = nome !== undefined ? String(nome).trim() : cliente.nome;
  if (!novoNome) {
    return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
  }

  const limpar = (v) => (v === undefined ? undefined : v === null ? null : String(v).trim() || null);

  const novoTelefone = limpar(telefone);
  const novoWhatsapp = limpar(whatsapp);
  const novoEmail = limpar(email);
  const novoNascimento = limpar(data_nascimento);

  cliente.nome = novoNome;
  if (novoTelefone !== undefined) cliente.telefone = novoTelefone;
  if (novoWhatsapp !== undefined) cliente.whatsapp = novoWhatsapp;
  if (novoEmail !== undefined) cliente.email = novoEmail;
  if (novoNascimento !== undefined) cliente.data_nascimento = novoNascimento;
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
