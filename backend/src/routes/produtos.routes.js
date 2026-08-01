const path = require('path');
const fs = require('fs');
const multer = require('multer');
const express = require('express');
const { db } = require('../db');
const autenticar = require('../middleware/auth');

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

function calcularPrecoVenda(custo, margem) {
  const custoNum = Number(custo) || 0;
  const margemNum = Number(margem) || 0;
  return Math.round(custoNum * (1 + margemNum / 100) * 100) / 100;
}

function normalizarProduto(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    preco_custo: linha.preco_custo,
    margem_percentual: linha.margem_percentual,
    preco_venda: linha.preco_venda,
    estoque: linha.estoque,
    foto: linha.foto,
    criado_em: linha.criado_em,
    atualizado_em: linha.atualizado_em,
  };
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

  const resultado = await db.run(
    `INSERT INTO produtos (nome, descricao, preco_custo, margem_percentual, preco_venda, estoque, foto)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    String(nome).trim(),
    descricao ? String(descricao).trim() : null,
    precoCusto,
    margem,
    precoVenda,
    estoqueNum,
    req.file ? '/uploads/' + req.file.filename : null
  );

  const produto = await db.get('SELECT * FROM produtos WHERE id = ?', resultado.lastInsertRowid);

  return res.status(201).json(normalizarProduto(produto));
});

router.get('/', async (req, res) => {
  const { busca } = req.query;
  let linhas;
  if (busca) {
    linhas = await db.all(
      `SELECT * FROM produtos
       WHERE nome LIKE ? OR descricao LIKE ?
       ORDER BY nome`,
      `%${busca}%`,
      `%${busca}%`
    );
  } else {
    linhas = await db.all('SELECT * FROM produtos ORDER BY nome');
  }
  return res.json(linhas.map(normalizarProduto));
});

router.get('/:id', async (req, res) => {
  const produto = await db.get('SELECT * FROM produtos WHERE id = ?', req.params.id);
  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado.' });
  }
  return res.json(normalizarProduto(produto));
});

router.put('/:id', upload.single('foto'), async (req, res) => {
  const produto = await db.get('SELECT * FROM produtos WHERE id = ?', req.params.id);
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

  await db.run(
    `UPDATE produtos
     SET nome = ?, descricao = ?, preco_custo = ?, margem_percentual = ?,
         preco_venda = ?, estoque = ?, foto = ?, atualizado_em = datetime('now', 'localtime')
     WHERE id = ?`,
    novoNome,
    descricao !== undefined ? String(descricao).trim() || null : produto.descricao,
    precoCusto,
    margem,
    precoVenda,
    estoqueNum,
    fotoNova,
    produto.id
  );

  const atualizado = await db.get('SELECT * FROM produtos WHERE id = ?', produto.id);
  return res.json(normalizarProduto(atualizado));
});

router.delete('/:id', async (req, res) => {
  const produto = await db.get('SELECT * FROM produtos WHERE id = ?', req.params.id);
  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado.' });
  }
  await db.run('DELETE FROM produtos WHERE id = ?', produto.id);
  removerFoto(produto.foto);
  return res.status(204).send();
});

module.exports = router;
