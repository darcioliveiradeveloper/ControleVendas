const express = require('express');
const Despesa = require('../models/Despesa');
const autenticar = require('../middleware/auth');
const { proximoId } = require('../ids');
const { agoraLocal, hoje, intervaloDia } = require('../utilidades');

const router = express.Router();

router.use(autenticar);

function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.post('/', async (req, res) => {
  const { descricao, valor, categoria, data } = req.body || {};

  if (!descricao || !String(descricao).trim()) {
    return res.status(400).json({ erro: 'A descrição da despesa é obrigatória.' });
  }
  const valorNum = Number(valor);
  if (!valorNum || valorNum <= 0) {
    return res.status(400).json({ erro: 'Informe um valor maior que zero.' });
  }
  const dataDespesa = data || hoje();

  const despesa = await Despesa.create({
    _id: await proximoId('despesas'),
    descricao: String(descricao).trim(),
    valor: Math.round(valorNum * 100) / 100,
    categoria: categoria ? String(categoria).trim() : null,
    data: dataDespesa,
    criado_em: agoraLocal(),
  });

  return res.status(201).json(despesa);
});

router.get('/', async (req, res) => {
  const { inicio, fim, busca } = req.query;
  const filtro = {};
  const intervalo = intervaloDia(inicio, fim);
  if (intervalo) filtro.data = { $gte: inicio, $lte: fim };
  if (busca) filtro.descricao = new RegExp(escaparRegex(busca), 'i');

  const linhas = await Despesa.find(filtro).sort({ data: -1, _id: -1 }).limit(200);
  return res.json(linhas);
});

router.put('/:id', async (req, res) => {
  const despesa = await Despesa.findById(Number(req.params.id));
  if (!despesa) {
    return res.status(404).json({ erro: 'Despesa não encontrada.' });
  }

  const { descricao, valor, categoria, data } = req.body || {};

  const novoValor = valor !== undefined ? Number(valor) : despesa.valor;
  if (novoValor !== undefined && (!novoValor || novoValor <= 0)) {
    return res.status(400).json({ erro: 'Informe um valor maior que zero.' });
  }

  if (descricao !== undefined) {
    if (!String(descricao).trim()) {
      return res.status(400).json({ erro: 'A descrição da despesa é obrigatória.' });
    }
    despesa.descricao = String(descricao).trim();
  }
  despesa.valor = Math.round((novoValor || despesa.valor) * 100) / 100;
  despesa.categoria = categoria !== undefined ? String(categoria).trim() || null : despesa.categoria;
  despesa.data = data || despesa.data;
  await despesa.save();

  return res.json(despesa);
});

router.delete('/:id', async (req, res) => {
  const despesa = await Despesa.findById(Number(req.params.id));
  if (!despesa) {
    return res.status(404).json({ erro: 'Despesa não encontrada.' });
  }
  await Despesa.deleteOne({ _id: despesa._id });
  return res.status(204).send();
});

module.exports = router;
