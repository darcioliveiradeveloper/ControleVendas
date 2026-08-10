const express = require('express');
const Produto = require('../models/Produto');
const MovimentoEstoque = require('../models/MovimentoEstoque');
const autenticar = require('../middleware/auth');
const { proximoId } = require('../ids');
const { agoraLocal, arredondar } = require('../utilidades');

const router = express.Router();

router.use(autenticar);

router.post('/movimentos', async (req, res) => {
  const { produto_id, tipo, quantidade, custo_unitario, observacao } = req.body || {};

  if (!produto_id) {
    return res.status(400).json({ erro: 'Selecione um produto.' });
  }
  if (tipo !== 'entrada' && tipo !== 'saida') {
    return res.status(400).json({ erro: 'Tipo inválido. Use entrada ou saida.' });
  }

  const qtd = parseInt(quantidade, 10);
  if (!qtd || qtd <= 0) {
    return res.status(400).json({ erro: 'A quantidade deve ser maior que zero.' });
  }

  const idProduto = Number(produto_id);
  const produto = await Produto.findById(idProduto);
  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado.' });
  }

  const custo = tipo === 'entrada' && custo_unitario !== undefined
    ? Number(custo_unitario) || 0
    : null;

  const estoqueAntes = produto.estoque;

  try {
    if (tipo === 'saida') {
      const atualizado = await Produto.findOneAndUpdate(
        { _id: idProduto, estoque: { $gte: qtd } },
        { $inc: { estoque: -qtd }, $set: { atualizado_em: agoraLocal() } },
        { new: true }
      );
      if (!atualizado) {
        return res.status(400).json({
          erro: `Estoque insuficiente. Disponível: ${produto.estoque}.`,
        });
      }
    } else {
      const alteracoes = { $inc: { estoque: qtd }, $set: { atualizado_em: agoraLocal() } };
      if (custo !== null && custo > 0) {
        alteracoes.$set.preco_custo = custo;
        alteracoes.$set.preco_venda = arredondar(custo * (1 + produto.margem_percentual / 100));
      }
      await Produto.updateOne({ _id: idProduto }, alteracoes);
    }
  } catch (erro) {
    return res.status(500).json({ erro: 'Erro ao registrar movimento.' });
  }

  const custoAntigo = Number(produto.preco_custo) || 0;
  const custoNovo = tipo === 'entrada' && custo > 0 ? custo : custoAntigo;
  const variacao = tipo === 'entrada' ? arredondar(custoNovo - custoAntigo) : null;

  const movimento = await MovimentoEstoque.create({
    _id: await proximoId('movimentos_estoque'),
    produto_id: idProduto,
    produto_nome: produto.nome,
    tipo,
    quantidade: qtd,
    custo_unitario: custo,
    estoque_antes: estoqueAntes,
    estoque_depois: estoqueAntes + (tipo === 'entrada' ? qtd : -qtd),
    custo_antigo: custoAntigo,
    custo_novo: custoNovo,
    variacao_valor: variacao,
    observacao: observacao ? String(observacao).trim() || null : null,
    criado_em: agoraLocal(),
  });

  const novoProduto = await Produto.findById(idProduto);
  return res.status(201).json({ movimento, estoque_atual: novoProduto.estoque });
});

router.get('/movimentos', async (req, res) => {
  const { produto_id, tipo } = req.query;
  const filtro = {};
  if (produto_id) filtro.produto_id = Number(produto_id);
  if (tipo) filtro.tipo = tipo;

  const linhas = await MovimentoEstoque.find(filtro).sort({ _id: -1 }).limit(200);
  return res.json(linhas);
});

router.put('/movimentos/:id', async (req, res) => {
  const { produto_id, quantidade, custo_unitario, observacao } = req.body || {};

  const movimento = await MovimentoEstoque.findById(Number(req.params.id));
  if (!movimento) {
    return res.status(404).json({ erro: 'Movimento não encontrado.' });
  }

  const idNovo = Number(produto_id) || movimento.produto_id;
  const qtd = parseInt(quantidade, 10);
  if (!qtd || qtd <= 0) {
    return res.status(400).json({ erro: 'A quantidade deve ser maior que zero.' });
  }

  try {
    const produtoAntigo = await Produto.findById(movimento.produto_id);
    if (produtoAntigo) {
      const estoqueReverso =
        movimento.tipo === 'entrada'
          ? produtoAntigo.estoque - movimento.quantidade
          : produtoAntigo.estoque + movimento.quantidade;
      if (estoqueReverso < 0) {
        return res.status(400).json({
          erro: 'Não é possível editar: o estoque atual não permite desfazer este movimento.',
        });
      }
      await Produto.updateOne(
        { _id: produtoAntigo._id },
        { $set: { estoque: estoqueReverso, atualizado_em: agoraLocal() } }
      );
    }

    const produtoNovo = await Produto.findById(idNovo);
    if (!produtoNovo) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    const custo = custo_unitario !== undefined ? Number(custo_unitario) || 0 : null;
    const estoqueAntes = Number(produtoNovo.estoque) || 0;
    const custoAntigo = Number(produtoNovo.preco_custo) || 0;
    const custoNovo = custo !== null && custo > 0 ? custo : custoAntigo;
    const variacao = arredondar(custoNovo - custoAntigo);

    const alteracoes = { $inc: { estoque: qtd }, $set: { atualizado_em: agoraLocal() } };
    if (custo !== null && custo > 0) {
      alteracoes.$set.preco_custo = custo;
      alteracoes.$set.preco_venda = arredondar(custo * (1 + produtoNovo.margem_percentual / 100));
    }
    await Produto.updateOne({ _id: produtoNovo._id }, alteracoes);

    await MovimentoEstoque.updateOne(
      { _id: movimento._id },
      {
        $set: {
          produto_id: idNovo,
          produto_nome: produtoNovo.nome,
          tipo: 'entrada',
          quantidade: qtd,
          custo_unitario: custo,
          estoque_antes: estoqueAntes,
          estoque_depois: estoqueAntes + qtd,
          custo_antigo: custoAntigo,
          custo_novo: custoNovo,
          variacao_valor: variacao,
          observacao: observacao ? String(observacao).trim() || null : null,
        },
      }
    );
  } catch (erro) {
    return res.status(500).json({ erro: 'Erro ao editar movimento.' });
  }

  const novoProduto = await Produto.findById(idNovo);
  return res.json({ ok: true, estoque_atual: novoProduto.estoque });
});

router.delete('/movimentos/:id', async (req, res) => {
  const movimento = await MovimentoEstoque.findById(Number(req.params.id));
  if (!movimento) {
    return res.status(404).json({ erro: 'Movimento não encontrado.' });
  }

  const produto = await Produto.findById(movimento.produto_id);
  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado.' });
  }

  const novoEstoque =
    movimento.tipo === 'entrada' ? produto.estoque - movimento.quantidade : produto.estoque + movimento.quantidade;

  if (novoEstoque < 0) {
    return res.status(400).json({
      erro: 'Não é possível excluir: o estoque atual não permite desfazer este movimento.',
    });
  }

  try {
    await Produto.updateOne(
      { _id: produto._id },
      { $set: { estoque: novoEstoque, atualizado_em: agoraLocal() } }
    );
    await MovimentoEstoque.deleteOne({ _id: movimento._id });
  } catch (erro) {
    return res.status(500).json({ erro: 'Erro ao estornar movimento.' });
  }

  return res.json({ ok: true, estoque_atual: novoEstoque });
});

module.exports = router;
