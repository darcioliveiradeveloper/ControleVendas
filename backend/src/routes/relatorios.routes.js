const express = require('express');
const Venda = require('../models/Venda');
const MovimentoEstoque = require('../models/MovimentoEstoque');
const Cliente = require('../models/Cliente');
const Produto = require('../models/Produto');
const autenticar = require('../middleware/auth');
const { hoje, arredondar, intervaloDia } = require('../utilidades');

const router = express.Router();

router.use(autenticar);

function periodoValido(inicio, fim) {
  return inicio && fim && inicio > fim;
}

async function consultarResumo(inicio, fim) {
  const intervalo = intervaloDia(inicio, fim);
  const temPeriodo = !!intervalo;

  const matchVendas = { status: 'ativa', tipo: 'venda' };
  if (temPeriodo) matchVendas.criado_em = { $gte: intervalo.inicio, $lte: intervalo.fim };

  const vendas = await Venda.aggregate([
    { $match: matchVendas },
    { $group: { _id: null, quantidade: { $sum: 1 }, receita: { $sum: '$total' } } },
  ]);

  const lucro = await Venda.aggregate([
    { $match: matchVendas },
    { $unwind: '$itens' },
    {
      $group: {
        _id: null,
        lucro: { $sum: { $multiply: [{ $subtract: ['$itens.preco_unitario', '$itens.custo_unitario'] }, '$itens.quantidade'] } },
        custo_vendido: { $sum: { $multiply: ['$itens.custo_unitario', '$itens.quantidade'] } },
      },
    },
  ]);

  const encomendas = await Venda.countDocuments({ status: 'ativa', tipo: 'encomenda' });

  const matchGastos = { tipo: 'entrada' };
  if (temPeriodo) matchGastos.criado_em = { $gte: intervalo.inicio, $lte: intervalo.fim };
  const gastos = await MovimentoEstoque.aggregate([
    { $match: matchGastos },
    { $group: { _id: null, quantidade: { $sum: 1 }, total: { $sum: { $multiply: ['$custo_unitario', '$quantidade'] } } } },
  ]);

  const parcelasAbertas = await Venda.aggregate([
    { $match: { status: 'ativa' } },
    { $unwind: '$parcelas' },
    { $match: { 'parcelas.pago': false } },
    { $group: { _id: null, quantidade: { $sum: 1 }, valor: { $sum: '$parcelas.valor' } } },
  ]);

  const matchVencidas = { 'parcelas.pago': false, 'parcelas.data_vencimento': { $lt: hoje() } };
  const parcelasVencidas = await Venda.aggregate([
    { $match: { status: 'ativa' } },
    { $unwind: '$parcelas' },
    { $match: matchVencidas },
    { $group: { _id: null, quantidade: { $sum: 1 }, valor: { $sum: '$parcelas.valor' } } },
  ]);

  const [clientes, produtos] = await Promise.all([
    Cliente.countDocuments(),
    Produto.countDocuments(),
  ]);

  const v = vendas[0] || {};
  const l = lucro[0] || {};
  const g = gastos[0] || {};
  const pa = parcelasAbertas[0] || {};
  const pv = parcelasVencidas[0] || {};

  return {
    periodo: temPeriodo ? { inicio, fim } : null,
    vendas: {
      quantidade: v.quantidade || 0,
      receita: arredondar(v.receita || 0),
      lucro: arredondar(l.lucro || 0),
      custo_vendido: arredondar(l.custo_vendido || 0),
    },
    encomendas_abertas: encomendas,
    gastos: {
      quantidade_movimentos: g.quantidade || 0,
      total: arredondar(g.total || 0),
    },
    parcelas_abertas: {
      quantidade: pa.quantidade || 0,
      valor: arredondar(pa.valor || 0),
    },
    parcelas_vencidas: {
      quantidade: pv.quantidade || 0,
      valor: arredondar(pv.valor || 0),
    },
    clientes,
    produtos,
  };
}

router.get('/resumo', async (req, res) => {
  const { inicio, fim } = req.query;
  if (periodoValido(inicio, fim)) {
    return res.status(400).json({ erro: 'A data inicial não pode ser maior que a final.' });
  }
  return res.json(await consultarResumo(inicio, fim));
});

router.get('/vendas', async (req, res) => {
  const { inicio, fim } = req.query;
  if (periodoValido(inicio, fim)) {
    return res.status(400).json({ erro: 'A data inicial não pode ser maior que a final.' });
  }

  const filtro = { status: 'ativa' };
  const intervalo = intervaloDia(inicio, fim);
  if (intervalo) filtro.criado_em = { $gte: intervalo.inicio, $lte: intervalo.fim };

  const linhas = await Venda.find(filtro).sort({ _id: -1 }).limit(200);
  const lista = linhas.map((v) => {
    const obj = v.toJSON();
    obj.lucro = arredondar(obj.itens.reduce((s, i) => s + (i.preco_unitario - i.custo_unitario) * i.quantidade, 0));
    obj.total_itens = obj.itens.length;
    obj.total_parcelas = obj.parcelas.length;
    obj.parcelas_pagas = obj.parcelas.filter((p) => p.pago).length;
    return obj;
  });
  return res.json(lista);
});

router.get('/parcelas', async (req, res) => {
  const { status } = req.query;
  const hojeStr = hoje();
  const vendas = await Venda.find({ status: 'ativa' });

  const lista = [];
  for (const venda of vendas) {
    for (const p of venda.parcelas) {
      if (p.pago) continue;
      if (status === 'vencidas' && !(p.data_vencimento < hojeStr)) continue;
      if (status === 'futuras' && !(p.data_vencimento >= hojeStr)) continue;
      lista.push({
        parcela_id: p.id,
        numero: p.numero,
        valor: p.valor,
        data_vencimento: p.data_vencimento,
        venda_id: venda._id,
        venda_total: venda.total,
        criado_em: venda.criado_em,
        cliente_nome: venda.cliente_nome,
      });
    }
  }

  lista.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento) || b.venda_id - a.venda_id);
  return res.json(lista);
});

router.get('/gastos', async (req, res) => {
  const { inicio, fim } = req.query;
  if (periodoValido(inicio, fim)) {
    return res.status(400).json({ erro: 'A data inicial não pode ser maior que a final.' });
  }

  const filtro = { tipo: 'entrada' };
  const intervalo = intervaloDia(inicio, fim);
  if (intervalo) filtro.criado_em = { $gte: intervalo.inicio, $lte: intervalo.fim };

  const linhas = await MovimentoEstoque.find(filtro).sort({ _id: -1 }).limit(200);
  return res.json(linhas);
});

module.exports = router;
