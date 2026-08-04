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
  const { cliente_id, tipo, forma_pagamento, numero_parcelas, data_primeira_parcela, primeira_parcela_avista, pago, itens } = req.body || {};

  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Adicione pelo menos um produto à venda.' });
  }

  const tipoVenda = tipo === 'encomenda' ? 'encomenda' : 'venda';
  const formasValidas = ['a_vista', 'pix', 'dinheiro', 'cartao', 'parcelado'];
  const forma = formasValidas.includes(forma_pagamento) ? forma_pagamento : 'a_vista';

  const itensCarregados = [];
  let pontosGanhos = 0;
  let pontosUtilizados = 0;
  for (const item of itens) {
    const qtd = parseInt(item.quantidade, 10);
    if (!qtd || qtd <= 0) {
      return res.status(400).json({ erro: 'Quantidade inválida em um dos produtos.' });
    }
    const desconto =
      item.desconto_percentual === undefined || item.desconto_percentual === null ? 0 : Number(item.desconto_percentual);
    if (desconto !== 0 && desconto !== 50) {
      return res.status(400).json({ erro: 'O desconto por pontos só pode ser de 50%.' });
    }
    const produto = await Produto.findById(Number(item.produto_id));
    if (!produto) {
      return res.status(400).json({ erro: 'Um dos produtos não foi encontrado.' });
    }
    itensCarregados.push({ produto, quantidade: qtd, desconto_percentual: desconto });
    pontosGanhos += qtd;
    if (desconto === 50) pontosUtilizados += 10;
  }

  if (tipoVenda === 'venda') {
    const faltando = itensCarregados
      .filter((i) => i.produto.estoque < i.quantidade)
      .map((i) => `${i.produto.nome} (disponível: ${i.produto.estoque})`);
    if (faltando.length) {
      return res.status(400).json({ erro: `Estoque insuficiente para: ${faltando.join(', ')}.` });
    }
  }

  let cliente = null;
  if (cliente_id) {
    cliente = await Cliente.findById(Number(cliente_id));
  }

  if (tipoVenda === 'encomenda' && pontosUtilizados > 0) {
    return res.status(400).json({ erro: 'Pontos só podem ser usados em vendas, não em encomendas.' });
  }
  if (cliente && pontosUtilizados > 0 && (cliente.pontos || 0) < pontosUtilizados) {
    return res.status(400).json({
      erro: `O cliente tem ${cliente.pontos || 0} ponto(s), mas precisa de ${pontosUtilizados}.`,
    });
  }

  const total = arredondar(
    itensCarregados.reduce(
      (s, i) => s + i.produto.preco_venda * (1 - i.desconto_percentual / 100) * i.quantidade,
      0
    )
  );

  let listaParcelas;
  if (forma !== 'parcelado') {
    const venc = data_primeira_parcela || hoje();
    const pagoNow = pago ? true : false;
    listaParcelas = [
      { numero: 1, valor: total, data_vencimento: venc, pago: pagoNow, data_pagamento: pagoNow ? hoje() : null },
    ];
  } else {
    const n = Math.max(1, parseInt(numero_parcelas, 10) || 1);
    const primeira = data_primeira_parcela || hoje();
    const valorBase = Math.floor((total * 100) / n) / 100;
    listaParcelas = [];
    let soma = 0;
    for (let i = 1; i <= n; i++) {
      const valor = i === n ? arredondar(total - soma) : valorBase;
      soma = arredondar(soma + valor);
      const pago = primeira_parcela_avista === true && i === 1;
      listaParcelas.push({
        numero: i,
        valor,
        data_vencimento: pago ? hoje() : adicionarMeses(primeira, i - 1),
        pago,
        data_pagamento: pago ? hoje() : null,
      });
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

  let clienteNome = cliente ? cliente.nome : null;

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
        preco_unitario: arredondar(i.produto.preco_venda * (1 - i.desconto_percentual / 100)),
        custo_unitario: i.produto.preco_custo,
        desconto_percentual: i.desconto_percentual,
      })),
      parcelas: listaParcelas,
      pontos_ganhos: tipoVenda === 'venda' ? pontosGanhos : 0,
      pontos_utilizados: pontosUtilizados,
      criado_em: agoraLocal(),
    });

    if (tipoVenda === 'venda' && cliente) {
      try {
        await Cliente.updateOne(
          { _id: cliente._id },
          {
            $inc: {
              pontos: pontosGanhos - pontosUtilizados,
              pontos_ganhos: pontosGanhos,
              pontos_utilizados: pontosUtilizados,
            },
            $set: { atualizado_em: agoraLocal() },
          }
        );
      } catch (e) {
        console.error('Erro ao atualizar pontos do cliente:', e.message);
      }
    }

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
  const pontosGanhos = venda.itens.reduce((s, i) => s + (i.quantidade || 0), 0);
  venda.pontos_ganhos = pontosGanhos;
  await venda.save();

  if (venda.cliente_id && pontosGanhos) {
    await Cliente.updateOne(
      { _id: venda.cliente_id },
      {
        $inc: { pontos: pontosGanhos, pontos_ganhos: pontosGanhos },
        $set: { atualizado_em: agoraLocal() },
      }
    );
  }

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

  if (venda.cliente_id && (venda.pontos_ganhos || venda.pontos_utilizados)) {
    await Cliente.updateOne(
      { _id: venda.cliente_id },
      {
        $inc: {
          pontos: -(venda.pontos_ganhos - venda.pontos_utilizados),
          pontos_ganhos: -venda.pontos_ganhos,
          pontos_utilizados: -venda.pontos_utilizados,
        },
        $set: { atualizado_em: agoraLocal() },
      }
    );
  }

  return res.json(detalhe(venda));
});

module.exports = router;
