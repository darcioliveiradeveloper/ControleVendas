const path = require('path');
const fs = require('fs');
const multer = require('multer');
const express = require('express');
const Produto = require('../models/Produto');
const MovimentoEstoque = require('../models/MovimentoEstoque');
const autenticar = require('../middleware/auth');
const { PASTA_IMAGENS } = require('../config');
const { salvarFoto, removerFotoId } = require('../fotos');
const { proximoId } = require('../ids');
const { agoraLocal, calcularPrecoVenda, calcularMargemPercentual, arredondar } = require('../utilidades');

const router = express.Router();

const PASTA_UPLOADS = PASTA_IMAGENS;
fs.mkdirSync(PASTA_UPLOADS, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PASTA_UPLOADS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(permitidos.includes(file.mimetype) ? null : new Error('Formato de imagem inválido.'), permitidos.includes(file.mimetype));
  },
});

function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removerFoto(caminho) {
  if (!caminho) return;
  const arquivo = path.join(PASTA_UPLOADS, path.basename(caminho));
  fs.unlink(arquivo, () => {});
}

async function removerFotoAntiga(caminho) {
  if (!caminho) return;
  if (String(caminho).startsWith('/api/fotos/')) {
    await removerFotoId(String(caminho).split('/api/fotos/')[1]);
  } else {
    removerFoto(caminho);
  }
}

async function baixarFoto(url) {
  if (!/^https?:\/\//i.test(String(url))) return null;
  try {
    const res = await fetch(String(url), { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const tipo = (res.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!tipo.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 2 * 1024 * 1024) return null;
    return { buffer: buf, tipo };
  } catch (e) {
    return null;
  }
}

async function guardarFoto(buffer, tipo) {
  const id = await salvarFoto(buffer, tipo);
  return '/api/fotos/' + id;
}

router.use(autenticar);

router.post('/', upload.single('foto'), async (req, res) => {
  const { nome, marca, tipo, tamanho, descricao, observacoes, preco_custo, margem_percentual, preco_venda, estoque, foto_url } = req.body || {};

  if (!nome || !String(nome).trim()) {
    if (req.file) removerFoto(req.file.path);
    return res.status(400).json({ erro: 'O nome do produto é obrigatório.' });
  }

  const precoCusto = Number(preco_custo) || 0;
  const precoVendaInformado = preco_venda !== undefined && String(preco_venda).trim() !== '';

  let precoVenda;
  let margem;
  if (precoVendaInformado) {
    precoVenda = arredondar(Number(preco_venda));
    if (precoVenda < 0) {
      if (req.file) removerFoto(req.file.path);
      return res.status(400).json({ erro: 'O preço de venda não pode ser negativo.' });
    }
    margem = calcularMargemPercentual(precoCusto, precoVenda);
  } else {
    margem = Number(margem_percentual) || 0;
    precoVenda = calcularPrecoVenda(precoCusto, margem);
  }
  const estoqueNum = Math.max(0, parseInt(estoque, 10) || 0);

  let foto = null;
  if (req.file) {
    const buffer = fs.readFileSync(req.file.path);
    fs.unlink(req.file.path, () => {});
    foto = await guardarFoto(buffer, req.file.mimetype);
  } else if (req.body.foto_url) {
    const baixada = await baixarFoto(req.body.foto_url);
    if (!baixada) {
      return res.status(400).json({ erro: 'Não foi possível baixar a imagem do link informado.' });
    }
    foto = await guardarFoto(baixada.buffer, baixada.tipo);
  }

  const produto = await Produto.create({
    _id: await proximoId('produtos'),
    nome: String(nome).trim(),
    marca: marca ? String(marca).trim() : null,
    tipo: tipo ? String(tipo).trim() : null,
    tamanho: tamanho ? String(tamanho).trim() : null,
    descricao: descricao ? String(descricao).trim() : null,
    observacoes: observacoes ? String(observacoes).trim() : null,
    preco_custo: precoCusto,
    margem_percentual: margem,
    preco_venda: precoVenda,
    estoque: estoqueNum,
    foto,
    criado_em: agoraLocal(),
  });

  return res.status(201).json(produto);
});

router.get('/', async (req, res) => {
  const { busca } = req.query;
  let filtro = {};
  if (busca) {
    const regex = new RegExp(escaparRegex(busca), 'i');
    filtro = { $or: [{ nome: regex }, { marca: regex }, { descricao: regex }] };
  }
  const linhas = await Produto.find(filtro).sort({ nome: 1 });
  return res.json(linhas);
});

router.get('/:id', async (req, res) => {
  const produto = await Produto.findById(Number(req.params.id));
  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado.' });
  }
  return res.json(produto);
});

router.put('/:id', upload.single('foto'), async (req, res) => {
  const produto = await Produto.findById(Number(req.params.id));
  if (!produto) {
    if (req.file) removerFoto(req.file.path);
    return res.status(404).json({ erro: 'Produto não encontrado.' });
  }

  const { nome, marca, tipo, tamanho, descricao, observacoes, preco_custo, margem_percentual, preco_venda, estoque, manter_foto, foto_url } = req.body || {};

  const novoNome = nome !== undefined ? String(nome).trim() : produto.nome;
  if (!novoNome) {
    if (req.file) removerFoto(req.file.path);
    return res.status(400).json({ erro: 'O nome do produto é obrigatório.' });
  }

  const precoCusto = preco_custo !== undefined ? Number(preco_custo) || 0 : produto.preco_custo;
  const precoVendaInformado = preco_venda !== undefined && String(preco_venda).trim() !== '';

  let precoVenda;
  let margem;
  if (precoVendaInformado) {
    precoVenda = arredondar(Number(preco_venda));
    if (precoVenda < 0) {
      if (req.file) removerFoto(req.file.path);
      return res.status(400).json({ erro: 'O preço de venda não pode ser negativo.' });
    }
    margem = calcularMargemPercentual(precoCusto, precoVenda);
  } else {
    margem = margem_percentual !== undefined ? Number(margem_percentual) || 0 : produto.margem_percentual;
    precoVenda = calcularPrecoVenda(precoCusto, margem);
  }
  const estoqueNum = estoque !== undefined ? Math.max(0, parseInt(estoque, 10) || 0) : produto.estoque;

  let fotoNova = produto.foto;
  if (req.file) {
    const buffer = fs.readFileSync(req.file.path);
    fs.unlink(req.file.path, () => {});
    const caminho = await guardarFoto(buffer, req.file.mimetype);
    await removerFotoAntiga(produto.foto);
    fotoNova = caminho;
  } else if (manter_foto === 'false') {
    await removerFotoAntiga(produto.foto);
    fotoNova = null;
  } else if (!req.file && req.body.foto_url) {
    const baixada = await baixarFoto(req.body.foto_url);
    if (!baixada) {
      return res.status(400).json({ erro: 'Não foi possível baixar a imagem do link informado.' });
    }
    const caminho = await guardarFoto(baixada.buffer, baixada.tipo);
    await removerFotoAntiga(produto.foto);
    fotoNova = caminho;
  }

  produto.nome = novoNome;
  produto.marca = marca !== undefined ? (marca ? String(marca).trim() : null) : produto.marca;
  produto.tipo = tipo !== undefined ? (tipo ? String(tipo).trim() : null) : produto.tipo;
  produto.tamanho = tamanho !== undefined ? (tamanho ? String(tamanho).trim() : null) : produto.tamanho;
  produto.descricao = descricao !== undefined ? String(descricao).trim() || null : produto.descricao;
  produto.observacoes = observacoes !== undefined ? String(observacoes).trim() || null : produto.observacoes;
  produto.preco_custo = precoCusto;
  produto.margem_percentual = margem;
  produto.preco_venda = precoVenda;
  produto.estoque = estoqueNum;
  produto.foto = fotoNova;
  produto.atualizado_em = agoraLocal();
  await produto.save();

  return res.json(produto);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const produto = await Produto.findById(id);
  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado.' });
  }
  await Produto.deleteOne({ _id: id });
  await MovimentoEstoque.deleteMany({ produto_id: id });
  await removerFotoAntiga(produto.foto);
  return res.status(204).send();
});

module.exports = router;
