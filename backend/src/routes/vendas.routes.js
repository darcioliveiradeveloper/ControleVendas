const express = require('express');
const Venda = require('../models/Venda');
const Produto = require('../models/Produto');
const Cliente = require('../models/Cliente');
const autenticar = require('../middleware/auth');
const { proximoId } = require('../ids');
const { agoraLocal, hoje, adicionarMeses, arredondar } = require('../utilidades');

const router = express.Router();

router.use(autenticar);

function detalhe(venda) {
  const obj = venda.toJSON();
  const pagas = obj.parcelas.filter((p) => p.pago);
  obj.parcelas_pagas = pagas.length;
  obj.valor_pago = arredondar(pagas.reduce((s, p) => s + p.valor, 0));
  obj.quitada = obj.parcelas.length > 0 && pagas.length === obj.parcelas.length;
  return obj;
}

function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.post('/', async (req, res) => {
  const { cliente_id, tipo, forma_pagamento, numero_parcelas, data_primeira_parcela, pago, itens } = req.body || {};

  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Adicione pelo menos um produto à venda.' });
  }

  const tipoVenda = tipo === 'encomenda' ? 'encomenda' : 'venda';
  const formasValidas = ['a_vista', 'pix', 'dinheiro', 'cartao', 'parcelado'];
  const forma = formasValidas.includes(forma_pagamento) ? forma_pagamento : 'a_vista';

  const itensCarregados = [];
  for (const item of itens) {
    const qtd = parseInt(item.quantidade, 10);
    if (!qtd || qtd <= 0) {
      return res.status(400).json({ erro: 'Quantidade inválida em um dos produtos.' });
    }
    const produto = await Produto.findById(Number(item.produto_id));
    if (!produto) {
      return res.status(400).json({ erro: 'Um dos produtos não foi encontrado.' });
    }
    itensCarregados.push({ produto, quantidade: qtd });
  }

  if (tipoVenda === 'venda') {
    const faltando = itensCarregados
      .filter((i) => i.produto.estoque < i.quantidade)
      .map((i) => `${i.produto.nome} (disponível: ${i.produto.estoque})`);
    if (faltando.length) {
      return res.status(400).json({ erro: `Estoque insuficiente para: ${faltando.join(', ')}.` });
    }
  }

  const total = arredondar(
    itensCarregados.reduce((s, i) => s + i.produto.preco_venda * i.quantidade, 0)
  );

  let listaParcelas;
  if (forma !== 'parcelado') {
    const venc = data_primeira_parcela || hoje();
    listaParcelas = [{ numero: 1, valor: total, data_vencimento: venc, pago: pago ? true : false }];
  } else {
    const n = Math.max(1, parseInt(numero_parcelas, 10) || 1);
    const primeira = data_primeira_parcela || hoje();
    const valorBase = Math.floor((total * 100) / n) / 100;
    listaParcelas = [];
    let soma = 0;
    for (let i = 1; i <= n; i++) {
      const valor = i === n ? arredondar(total - soma) : valorBase;
      soma = arredondar(soma + valor);
      listaParcelas.push({ numero: i, valor, data_vencimento: adicionarMeses(primeira, i - 1), pago: false });
    }
  }

  if (tipoVenda === 'venda') {
    for (const item of itensCarregados) {
      const atualizado = await Produto.findOneAndUpdate(
        { _id: item.produto._id, estoque: { $gte: item.quantidade } },
        { $inc: { estoque: -item.quantidade }, $set: { atualizado_em: agoraLocal() } }
      );
      if (!atualizado) {
        return res.status(400).json({ erro: `Estoque insuficiente para: ${item.produto.nome}.` });
      }
    }
  }

  let clienteNome = null;
  if (cliente_id) {
    const cliente = await Cliente.findById(Number(cliente_id));
    clienteNome = cliente ? cliente.nome : null;
  }

  try {
    const venda = await Venda.create({
      _id: await proximoId('vendas'),
      cliente_id: cliente_id ? Number(cliente_id) : null,
      cliente_nome: clienteNome,
      tipo: tipoVenda,
      forma_pagamento: forma,
      total,
      itens: itensCarregados.map((i) => ({
        produto_id: i.produto._id,
        produto_nome: i.produto.nome,
        quantidade: i.quantidade,
        preco_unitario: i.produto.preco_venda,
        custo_unitario: i.produto.preco_custo,
      })),
      parcelas: listaParcelas,
      criado_em: agoraLocal(),
    });

    return res.status(201).json(detalhe(venda));
  } catch (erro) {
    if (tipoVenda === 'venda') {
      for (const item of itensCarregados) {
        await Produto.updateOne({ _id: item.produto._id }, { $inc: { estoque: item.quantidade } });
      }
    }
    return res.status(500).json({ erro: 'Erro ao registrar a venda.' });
  }
});

router.get('/', async (req, res) => {
  const { tipo, status, busca } = req.query;
  const filtro = {};
  if (tipo) filtro.tipo = tipo;
  if (status) filtro.status = status;
  if (busca) filtro.cliente_nome = new RegExp(escaparRegex(busca), 'i');

  const linhas = await Venda.find(filtro).sort({ _id: -1 }).limit(100);
  const lista = linhas.map((v) => {
    const obj = v.toJSON();
    const pagas = obj.parcelas.filter((p) => p.pago);
    obj.total_itens = obj.itens.length;
    obj.total_parcelas = obj.parcelas.length;
    obj.parcelas_pagas = pagas.length;
    obj.valor_pago = arredondar(pagas.reduce((s, p) => s + p.valor, 0));
    return obj;
  });
  return res.json(lista);
});

router.get('/:id', async (req, res) => {
  const venda = await Venda.findById(Number(req.params.id));
  if (!venda) {
    return res.status(404).json({ erro: 'Venda não encontrada.' });
  }
  return res.json(detalhe(venda));
});

router.put('/:id/parcelas/:parcelaId', async (req, res) => {
  const venda = await Venda.findById(Number(req.params.id));
  if (!venda) {
    return res.status(404).json({ erro: 'Venda não encontrada.' });
  }
  if (venda.status === 'cancelada') {
    return res.status(400).json({ erro: 'Não é possível alterar parcelas de uma venda cancelada.' });
  }

  const parcela = venda.parcelas.id(req.params.parcelaId);
  if (!parcela) {
    return res.status(404).json({ erro: 'Parcela não encontrada.' });
  }

  const { pago } = req.body || {};
  parcela.pago = pago ? true : false;
  parcela.data_pagamento = pago ? hoje() : null;
  await venda.save();

  return res.json(detalhe(venda));
});

router.post('/:id/confirmar', async (req, res) => {
  const venda = await Venda.findById(Number(req.params.id));
  if (!venda) {
    return res.status(404).json({ erro: 'Venda não encontrada.' });
  }
  if (venda.status !== 'ativa') {
    return res.status(400).json({ erro: 'A venda não está ativa.' });
  }
  if (venda.tipo !== 'encomenda') {
    return res.status(400).json({ erro: 'Esta venda não é uma encomenda.' });
  }

  const faltando = [];
  for (const item of venda.itens) {
    const produto = await Produto.findById(item.produto_id);
    if (!produto || produto.estoque < item.quantidade) {
      faltando.push(`${item.produto_nome || 'Produto removido'} (disponível: ${produto ? produto.estoque : 0})`);
    }
  }
  if (faltando.length) {
    return res.status(400).json({ erro: `Estoque insuficiente para confirmar a encomenda: ${faltando.join(', ')}.` });
  }

  for (const item of venda.itens) {
    await Produto.findOneAndUpdate(
      { _id: item.produto_id, estoque: { $gte: item.quantidade } },
      { $inc: { estoque: -item.quantidade }, $set: { atualizado_em: agoraLocal() } }
    );
  }
  venda.tipo = 'venda';
  await venda.save();

  return res.json(detalhe(venda));
});

router.delete('/:id', async (req, res) => {
  const venda = await Venda.findById(Number(req.params.id));
  if (!venda) {
    return res.status(404).json({ erro: 'Venda não encontrada.' });
  }
  if (venda.status === 'cancelada') {
    return res.status(400).json({ erro: 'Venda já cancelada.' });
  }

  if (venda.tipo === 'venda') {
    for (const item of venda.itens) {
      await Produto.updateOne(
        { _id: item.produto_id },
        { $inc: { estoque: item.quantidade }, $set: { atualizado_em: agoraLocal() } }
      );
    }
  }
  venda.status = 'cancelada';
  await venda.save();

  return res.json(detalhe(venda));
});

module.exports = router;
