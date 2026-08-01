const express = require('express');
const db = require('../db');
const autenticar = require('../middleware/auth');

const router = express.Router();

router.use(autenticar);

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function addMeses(data, meses) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(ano, mes - 1 + meses, dia);
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${a}-${m}-${dd}`;
}

function getVendaDetalhe(id) {
  const venda = db
    .prepare(
      `SELECT v.*, c.nome AS cliente_nome
       FROM vendas v
       LEFT JOIN clientes c ON c.id = v.cliente_id
       WHERE v.id = ?`
    )
    .get(id);
  if (!venda) return null;

  venda.itens = db
    .prepare(
      `SELECT i.*, p.nome AS produto_nome
       FROM venda_itens i
       JOIN produtos p ON p.id = i.produto_id
       WHERE i.venda_id = ?`
    )
    .all(id);

  venda.parcelas = db
    .prepare('SELECT * FROM parcelas WHERE venda_id = ? ORDER BY numero')
    .all(id);

  const pagas = venda.parcelas.filter((p) => p.pago);
  venda.parcelas_pagas = pagas.length;
  venda.valor_pago = Math.round(pagas.reduce((s, p) => s + p.valor, 0) * 100) / 100;
  venda.quitada = venda.parcelas.length > 0 && pagas.length === venda.parcelas.length;

  return venda;
}

router.post('/', (req, res) => {
  const { cliente_id, tipo, forma_pagamento, numero_parcelas, data_primeira_parcela, pago, itens } = req.body || {};

  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Adicione pelo menos um produto à venda.' });
  }

  const tipoVenda = tipo === 'encomenda' ? 'encomenda' : 'venda';
  const forma = forma_pagamento === 'parcelado' ? 'parcelado' : 'a_vista';

  const itensCarregados = [];
  for (const item of itens) {
    const qtd = parseInt(item.quantidade, 10);
    if (!qtd || qtd <= 0) {
      return res.status(400).json({ erro: 'Quantidade inválida em um dos produtos.' });
    }
    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(item.produto_id);
    if (!produto) {
      return res.status(400).json({ erro: 'Um dos produtos não foi encontrado.' });
    }
    itensCarregados.push({ ...produto, quantidade: qtd });
  }

  if (tipoVenda === 'venda') {
    const faltando = itensCarregados
      .filter((i) => i.estoque < i.quantidade)
      .map((i) => `${i.nome} (disponível: ${i.estoque})`);
    if (faltando.length) {
      return res.status(400).json({ erro: `Estoque insuficiente para: ${faltando.join(', ')}.` });
    }
  }

  const total = Math.round(itensCarregados.reduce((s, i) => s + i.preco_venda * i.quantidade, 0) * 100) / 100;

  let listaParcelas;
  if (forma === 'a_vista') {
    const venc = data_primeira_parcela || hoje();
    listaParcelas = [{ numero: 1, valor: total, data_vencimento: venc, pago: pago ? 1 : 0 }];
  } else {
    const n = Math.max(1, parseInt(numero_parcelas, 10) || 1);
    const primeira = data_primeira_parcela || hoje();
    const valorBase = Math.floor((total * 100) / n) / 100;
    listaParcelas = [];
    let soma = 0;
    for (let i = 1; i <= n; i++) {
      const valor = i === n ? Math.round((total - soma) * 100) / 100 : valorBase;
      soma = Math.round((soma + valor) * 100) / 100;
      listaParcelas.push({ numero: i, valor, data_vencimento: addMeses(primeira, i - 1), pago: 0 });
    }
  }

  const transacao = db.transaction(() => {
    const resultado = db
      .prepare('INSERT INTO vendas (cliente_id, tipo, forma_pagamento, total) VALUES (?, ?, ?, ?)')
      .run(cliente_id || null, tipoVenda, forma, total);
    const vendaId = resultado.lastInsertRowid;

    for (const item of itensCarregados) {
      db.prepare(
        'INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, custo_unitario) VALUES (?, ?, ?, ?, ?)'
      ).run(vendaId, item.id, item.quantidade, item.preco_venda, item.preco_custo);

      if (tipoVenda === 'venda') {
        db.prepare('UPDATE produtos SET estoque = estoque - ?, atualizado_em = datetime(\'now\', \'localtime\') WHERE id = ?')
          .run(item.quantidade, item.id);
      }
    }

    for (const p of listaParcelas) {
      db.prepare(
        'INSERT INTO parcelas (venda_id, numero, valor, data_vencimento, pago, data_pagamento) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(vendaId, p.numero, p.valor, p.data_vencimento, p.pago, p.pago ? hoje() : null);
    }

    return vendaId;
  });

  try {
    const vendaId = transacao();
    return res.status(201).json(getVendaDetalhe(vendaId));
  } catch (erro) {
    return res.status(500).json({ erro: 'Erro ao registrar a venda.' });
  }
});

router.get('/', (req, res) => {
  const { tipo, status, busca } = req.query;

  let sql = `
    SELECT v.id, v.cliente_id, v.tipo, v.forma_pagamento, v.total, v.status, v.criado_em,
           c.nome AS cliente_nome,
           (SELECT COUNT(*) FROM venda_itens i WHERE i.venda_id = v.id) AS total_itens,
           (SELECT COUNT(*) FROM parcelas pa WHERE pa.venda_id = v.id) AS total_parcelas,
           (SELECT COUNT(*) FROM parcelas pa WHERE pa.venda_id = v.id AND pa.pago = 1) AS parcelas_pagas,
           (SELECT COALESCE(SUM(pa.valor), 0) FROM parcelas pa WHERE pa.venda_id = v.id AND pa.pago = 1) AS valor_pago
    FROM vendas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
  `;

  const cond = [];
  const params = [];
  if (tipo) { cond.push('v.tipo = ?'); params.push(tipo); }
  if (status) { cond.push('v.status = ?'); params.push(status); }
  if (busca) { cond.push('c.nome LIKE ?'); params.push(`%${busca}%`); }
  if (cond.length) sql += ' WHERE ' + cond.join(' AND ');

  sql += ' ORDER BY v.id DESC LIMIT 100';
  return res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const venda = getVendaDetalhe(req.params.id);
  if (!venda) {
    return res.status(404).json({ erro: 'Venda não encontrada.' });
  }
  return res.json(venda);
});

router.put('/:id/parcelas/:parcelaId', (req, res) => {
  const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(req.params.id);
  if (!venda) {
    return res.status(404).json({ erro: 'Venda não encontrada.' });
  }
  if (venda.status === 'cancelada') {
    return res.status(400).json({ erro: 'Não é possível alterar parcelas de uma venda cancelada.' });
  }
  const parcela = db
    .prepare('SELECT * FROM parcelas WHERE id = ? AND venda_id = ?')
    .get(req.params.parcelaId, venda.id);
  if (!parcela) {
    return res.status(404).json({ erro: 'Parcela não encontrada.' });
  }

  const { pago } = req.body || {};
  db.prepare('UPDATE parcelas SET pago = ?, data_pagamento = ? WHERE id = ?').run(
    pago ? 1 : 0,
    pago ? hoje() : null,
    parcela.id
  );

  return res.json(getVendaDetalhe(venda.id));
});

router.post('/:id/confirmar', (req, res) => {
  const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(req.params.id);
  if (!venda) {
    return res.status(404).json({ erro: 'Venda não encontrada.' });
  }
  if (venda.status !== 'ativa') {
    return res.status(400).json({ erro: 'A venda não está ativa.' });
  }
  if (venda.tipo !== 'encomenda') {
    return res.status(400).json({ erro: 'Esta venda não é uma encomenda.' });
  }

  const itens = db.prepare('SELECT * FROM venda_itens WHERE venda_id = ?').all(venda.id);
  const faltando = [];
  for (const item of itens) {
    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(item.produto_id);
    if (!produto || produto.estoque < item.quantidade) {
      faltando.push(`${produto ? produto.nome : 'Produto removido'} (disponível: ${produto ? produto.estoque : 0})`);
    }
  }
  if (faltando.length) {
    return res.status(400).json({ erro: `Estoque insuficiente para confirmar a encomenda: ${faltando.join(', ')}.` });
  }

  const transacao = db.transaction(() => {
    for (const item of itens) {
      db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ?').run(item.quantidade, item.produto_id);
    }
    db.prepare('UPDATE vendas SET tipo = \'venda\' WHERE id = ?').run(venda.id);
  });

  try {
    transacao();
    return res.json(getVendaDetalhe(venda.id));
  } catch (erro) {
    return res.status(500).json({ erro: 'Erro ao confirmar a encomenda.' });
  }
});

router.delete('/:id', (req, res) => {
  const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(req.params.id);
  if (!venda) {
    return res.status(404).json({ erro: 'Venda não encontrada.' });
  }
  if (venda.status === 'cancelada') {
    return res.status(400).json({ erro: 'Venda já cancelada.' });
  }

  const itens = db.prepare('SELECT * FROM venda_itens WHERE venda_id = ?').all(venda.id);

  const transacao = db.transaction(() => {
    if (venda.tipo === 'venda') {
      for (const item of itens) {
        db.prepare('UPDATE produtos SET estoque = estoque + ? WHERE id = ?').run(item.quantidade, item.produto_id);
      }
    }
    db.prepare('UPDATE vendas SET status = \'cancelada\' WHERE id = ?').run(venda.id);
  });

  try {
    transacao();
    return res.json(getVendaDetalhe(venda.id));
  } catch (erro) {
    return res.status(500).json({ erro: 'Erro ao cancelar a venda.' });
  }
});

module.exports = router;
