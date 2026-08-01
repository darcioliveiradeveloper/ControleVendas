const express = require('express');
const db = require('../db');
const autenticar = require('../middleware/auth');

const router = express.Router();

router.use(autenticar);

function validarPeriodo(inicio, fim) {
  if (inicio && fim && inicio > fim) return null;
  return { inicio: inicio || null, fim: fim || null };
}

function consultarResumo(inicio, fim) {
  const periodo = validarPeriodo(inicio, fim);
  const temPeriodo = !!(periodo && periodo.inicio);

  const paramsV = [];
  let sqlVendas =
    `SELECT COUNT(*) AS quantidade, COALESCE(SUM(total), 0) AS receita
     FROM vendas WHERE status = 'ativa' AND tipo = 'venda'`;
  if (temPeriodo) {
    sqlVendas += ' AND date(criado_em) BETWEEN ? AND ?';
    paramsV.push(periodo.inicio, periodo.fim);
  }
  const vendas = db.prepare(sqlVendas).get(...paramsV);

  let sqlLucro =
    `SELECT COALESCE(SUM((i.preco_unitario - i.custo_unitario) * i.quantidade), 0) AS lucro,
            COALESCE(SUM(i.custo_unitario * i.quantidade), 0) AS custo_vendido
     FROM venda_itens i
     JOIN vendas v ON v.id = i.venda_id
     WHERE v.status = 'ativa' AND v.tipo = 'venda'`;
  if (temPeriodo) {
    sqlLucro += ' AND date(v.criado_em) BETWEEN ? AND ?';
  }
  const lucro = db.prepare(sqlLucro).get(...paramsV);

  const encomendas = db
    .prepare("SELECT COUNT(*) AS quantidade FROM vendas WHERE status = 'ativa' AND tipo = 'encomenda'")
    .get();

  const paramsG = [];
  let sqlGastos =
    `SELECT COUNT(*) AS quantidade, COALESCE(SUM(custo_unitario * quantidade), 0) AS total
     FROM movimentos_estoque WHERE tipo = 'entrada'`;
  if (temPeriodo) {
    sqlGastos += ' AND date(criado_em) BETWEEN ? AND ?';
    paramsG.push(periodo.inicio, periodo.fim);
  }
  const gastos = db.prepare(sqlGastos).get(...paramsG);

  const parcelasAbertas = db
    .prepare(
      `SELECT COUNT(*) AS quantidade, COALESCE(SUM(pa.valor), 0) AS valor
       FROM parcelas pa JOIN vendas v ON v.id = pa.venda_id
       WHERE v.status = 'ativa' AND pa.pago = 0`
    )
    .get();

  const parcelasVencidas = db
    .prepare(
      `SELECT COUNT(*) AS quantidade, COALESCE(SUM(pa.valor), 0) AS valor
       FROM parcelas pa JOIN vendas v ON v.id = pa.venda_id
       WHERE v.status = 'ativa' AND pa.pago = 0 AND pa.data_vencimento < date('now', 'localtime')`
    )
    .get();

  const clientes = db.prepare('SELECT COUNT(*) AS quantidade FROM clientes').get();
  const produtos = db.prepare('SELECT COUNT(*) AS quantidade FROM produtos').get();

  return {
    periodo: temPeriodo ? { inicio: periodo.inicio, fim: periodo.fim } : null,
    vendas: {
      quantidade: vendas.quantidade,
      receita: Math.round(vendas.receita * 100) / 100,
      lucro: Math.round(lucro.lucro * 100) / 100,
      custo_vendido: Math.round(lucro.custo_vendido * 100) / 100,
    },
    encomendas_abertas: encomendas.quantidade,
    gastos: {
      quantidade_movimentos: gastos.quantidade,
      total: Math.round(gastos.total * 100) / 100,
    },
    parcelas_abertas: {
      quantidade: parcelasAbertas.quantidade,
      valor: Math.round(parcelasAbertas.valor * 100) / 100,
    },
    parcelas_vencidas: {
      quantidade: parcelasVencidas.quantidade,
      valor: Math.round(parcelasVencidas.valor * 100) / 100,
    },
    clientes: clientes.quantidade,
    produtos: produtos.quantidade,
  };
}

router.get('/resumo', (req, res) => {
  const { inicio, fim } = req.query;
  if (inicio && fim && inicio > fim) {
    return res.status(400).json({ erro: 'A data inicial não pode ser maior que a final.' });
  }
  return res.json(consultarResumo(inicio, fim));
});

router.get('/vendas', (req, res) => {
  const { inicio, fim } = req.query;
  if (inicio && fim && inicio > fim) {
    return res.status(400).json({ erro: 'A data inicial não pode ser maior que a final.' });
  }

  let sql = `
    SELECT v.id, v.cliente_id, v.tipo, v.forma_pagamento, v.total, v.criado_em,
           c.nome AS cliente_nome,
           COALESCE(SUM((i.preco_unitario - i.custo_unitario) * i.quantidade), 0) AS lucro,
           (SELECT COUNT(*) FROM venda_itens it WHERE it.venda_id = v.id) AS total_itens,
           (SELECT COUNT(*) FROM parcelas pa WHERE pa.venda_id = v.id) AS total_parcelas,
           (SELECT COUNT(*) FROM parcelas pa WHERE pa.venda_id = v.id AND pa.pago = 1) AS parcelas_pagas
    FROM vendas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN venda_itens i ON i.venda_id = v.id
    WHERE v.status = 'ativa'
  `;
  const params = [];
  if (inicio && fim) {
    sql += ' AND date(v.criado_em) BETWEEN ? AND ?';
    params.push(inicio, fim);
  }
  sql += ' GROUP BY v.id ORDER BY v.id DESC LIMIT 200';

  const linhas = db.prepare(sql).all(...params);
  return res.json(
    linhas.map((l) => ({
      ...l,
      lucro: Math.round(l.lucro * 100) / 100,
    }))
  );
});

router.get('/parcelas', (req, res) => {
  const { status } = req.query;

  let sql = `
    SELECT pa.id AS parcela_id, pa.numero, pa.valor, pa.data_vencimento,
           v.id AS venda_id, v.total AS venda_total, v.criado_em,
           c.nome AS cliente_nome
    FROM parcelas pa
    JOIN vendas v ON v.id = pa.venda_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE v.status = 'ativa' AND pa.pago = 0
  `;
  if (status === 'vencidas') {
    sql += " AND pa.data_vencimento < date('now', 'localtime')";
  } else if (status === 'futuras') {
    sql += " AND pa.data_vencimento >= date('now', 'localtime')";
  }
  sql += ' ORDER BY pa.data_vencimento ASC, v.id DESC';

  return res.json(db.prepare(sql).all());
});

router.get('/gastos', (req, res) => {
  const { inicio, fim } = req.query;
  if (inicio && fim && inicio > fim) {
    return res.status(400).json({ erro: 'A data inicial não pode ser maior que a final.' });
  }

  let sql = `
    SELECT m.id, m.produto_id, m.quantidade, m.custo_unitario, m.observacao, m.criado_em,
           p.nome AS produto_nome
    FROM movimentos_estoque m
    JOIN produtos p ON p.id = m.produto_id
    WHERE m.tipo = 'entrada'
  `;
  const params = [];
  if (inicio && fim) {
    sql += ' AND date(m.criado_em) BETWEEN ? AND ?';
    params.push(inicio, fim);
  }
  sql += ' ORDER BY m.id DESC LIMIT 200';

  return res.json(db.prepare(sql).all(...params));
});

module.exports = router;
