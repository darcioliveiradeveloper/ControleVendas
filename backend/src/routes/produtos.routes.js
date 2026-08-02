const path = require('path');
const fs = require('fs');
const multer = require('multer');
const express = require('express');
const Produto = require('../models/Produto');
const MovimentoEstoque = require('../models/MovimentoEstoque');
const autenticar = require('../middleware/auth');
const { proximoId } = require('../ids');
const { agoraLocal, calcularPrecoVenda } = require('../utilidades');

const router = express.Router();

const PASTA_UPLOADS = path.join(__dirname, '..', '..', 'uploads');
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

router.use(autenticar);

router.post('/', upload.single('foto'), async (req, res) => {
  const { nome, descricao, preco_custo, margem_percentual, estoque } = req.body || {};

  if (!nome || !String(nome).trim()) {
    if (req.file) removerFoto(req.file.path);
    return res.status(400).json({ erro: 'O nome do produto é obrigatório.' });
  }

  const precoCusto = Number(preco_custo) || 0;
  const margem = Number(margem_percentual) || 0;
  const precoVenda = calcularPrecoVenda(precoCusto, margem);
  const estoqueNum = Math.max(0, parseInt(estoque, 10) || 0);

  const produto = await Produto.create({
    _id: await proximoId('produtos'),
    nome: String(nome).trim(),
    descricao: descricao ? String(descricao).trim() : null,
    preco_custo: precoCusto,
    margem_percentual: margem,
    preco_venda: precoVenda,
    estoque: estoqueNum,
    foto: req.file ? '/uploads/' + req.file.filename : null,
    criado_em: agoraLocal(),
  });

  return res.status(201).json(produto);
});

router.get('/', async (req, res) => {
  const { busca } = req.query;
  let filtro = {};
  if (busca) {
    const regex = new RegExp(escaparRegex(busca), 'i');
    filtro = { $or: [{ nome: regex }, { descricao: regex }] };
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

  const { nome, descricao, preco_custo, margem_percentual, estoque, manter_foto } = req.body || {};

  const novoNome = nome !== undefined ? String(nome).trim() : produto.nome;
  if (!novoNome) {
    if (req.file) removerFoto(req.file.path);
    return res.status(400).json({ erro: 'O nome do produto é obrigatório.' });
  }

  const precoCusto = preco_custo !== undefined ? Number(preco_custo) || 0 : produto.preco_custo;
  const margem = margem_percentual !== undefined ? Number(margem_percentual) || 0 : produto.margem_percentual;
  const precoVenda = calcularPrecoVenda(precoCusto, margem);
  const estoqueNum = estoque !== undefined ? Math.max(0, parseInt(estoque, 10) || 0) : produto.estoque;

  let fotoNova = produto.foto;
  if (req.file) {
    fotoNova = '/uploads/' + req.file.filename;
    removerFoto(produto.foto);
  } else if (manter_foto === 'false') {
    removerFoto(produto.foto);
    fotoNova = null;
  }

  produto.nome = novoNome;
  produto.descricao = descricao !== undefined ? String(descricao).trim() || null : produto.descricao;
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
  removerFoto(produto.foto);
  return res.status(204).send();
});

module.exports = router;
