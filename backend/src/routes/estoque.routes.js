const express = require('express');
const { db } = require('../db');
const autenticar = require('../middleware/auth');

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

  const produto = await db.get('SELECT * FROM produtos WHERE id = ?', produto_id);
  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado.' });
  }

  if (tipo === 'saida' && qtd > produto.estoque) {
    return res.status(400).json({
      erro: `Estoque insuficiente. Disponível: ${produto.estoque}.`,
    });
  }

  const custo = tipo === 'entrada' && custo_unitario !== undefined
    ? Number(custo_unitario) || 0
    : null;

  const novoEstoque =
    tipo === 'entrada' ? produto.estoque + qtd : produto.estoque - qtd;

  try {
    const movimento = await db.transacao(async (tx) => {
      const resultado = await tx.run(
        `INSERT INTO movimentos_estoque (produto_id, tipo, quantidade, custo_unitario, observacao)
         VALUES (?, ?, ?, ?, ?)`,
        produto_id,
        tipo,
        qtd,
        custo,
        observacao ? String(observacao).trim() || null : null
      );

      if (tipo === 'entrada' && custo !== null && custo > 0) {
        const margem = produto.margem_percentual;
        const novoPrecoVenda = Math.round(custo * (1 + margem / 100) * 100) / 100;
        await tx.run(
          `UPDATE produtos
           SET preco_custo = ?, preco_venda = ?, atualizado_em = datetime('now', 'localtime')
           WHERE id = ?`,
          custo,
          novoPrecoVenda,
          produto_id
        );
      }

      await tx.run('UPDATE produtos SET estoque = ? WHERE id = ?', novoEstoque, produto_id);

      return tx.get(
        `SELECT m.*, p.nome AS produto_nome
         FROM movimentos_estoque m
         JOIN produtos p ON p.id = m.produto_id
         WHERE m.id = ?`,
        resultado.lastInsertRowid
      );
    });

    const novoProduto = await db.get('SELECT * FROM produtos WHERE id = ?', produto_id);
    return res.status(201).json({ movimento, estoque_atual: novoProduto.estoque });
  } catch (erro) {
    return res.status(500).json({ erro: 'Erro ao registrar movimento.' });
  }
});

router.get('/movimentos', async (req, res) => {
  const { produto_id, tipo } = req.query;

  let sql = `
    SELECT m.*, p.nome AS produto_nome
    FROM movimentos_estoque m
    JOIN produtos p ON p.id = m.produto_id
  `;
  const params = [];

  if (produto_id) {
    sql += ' WHERE m.produto_id = ?';
    params.push(produto_id);
  }
  if (tipo) {
    sql += sql.includes('WHERE') ? ' AND m.tipo = ?' : ' WHERE m.tipo = ?';
    params.push(tipo);
  }

  sql += ' ORDER BY m.id DESC LIMIT 200';
  const linhas = await db.all(sql, ...params);
  return res.json(linhas);
});

router.delete('/movimentos/:id', async (req, res) => {
  const movimento = await db.get('SELECT * FROM movimentos_estoque WHERE id = ?', req.params.id);
  if (!movimento) {
    return res.status(404).json({ erro: 'Movimento não encontrado.' });
  }

  const produto = await db.get('SELECT * FROM produtos WHERE id = ?', movimento.produto_id);
  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado.' });
  }

  const novoEstoque =
    movimento.tipo === 'entrada' ? produto.estoque - movimento.quantidade : produto.estoque + movimento.quantidade;

  if (novoEstoque < 0) {
    return res.status(400).json({
      erro: 'Não é possível estornar: o estoque atual não permite desfazer esta entrada.',
    });
  }

  try {
    await db.transacao(async (tx) => {
      await tx.run('UPDATE produtos SET estoque = ? WHERE id = ?', novoEstoque, produto.id);
      await tx.run('DELETE FROM movimentos_estoque WHERE id = ?', movimento.id);
    });
    const novoProduto = await db.get('SELECT * FROM produtos WHERE id = ?', produto.id);
    return res.json({ ok: true, estoque_atual: novoProduto.estoque });
  } catch (erro) {
    return res.status(500).json({ erro: 'Erro ao estornar movimento.' });
  }
});

module.exports = router;
