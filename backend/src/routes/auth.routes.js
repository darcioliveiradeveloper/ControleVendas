const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');

const router = express.Router();

router.post('/registrar', async (req, res) => {
  const { nome, email, senha } = req.body || {};

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios.' });
  }

  const emailNormalizado = String(email).trim().toLowerCase();

  const existe = await db.get('SELECT id FROM usuarios WHERE email = ?', emailNormalizado);
  if (existe) {
    return res.status(409).json({ erro: 'Já existe uma conta com este email.' });
  }

  const senhaHash = bcrypt.hashSync(String(senha), 10);

  const resultado = await db.run(
    'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
    nome.trim(),
    emailNormalizado,
    senhaHash
  );

  const usuario = {
    id: resultado.lastInsertRowid,
    nome: nome.trim(),
    email: emailNormalizado,
  };

  const token = gerarToken(usuario);

  return res.status(201).json({ token, usuario });
});

router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {};

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
  }

  const emailNormalizado = String(email).trim().toLowerCase();
  const usuario = await db.get(
    'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?',
    emailNormalizado
  );

  if (!usuario || !bcrypt.compareSync(String(senha), usuario.senha_hash)) {
    return res.status(401).json({ erro: 'Email ou senha incorretos.' });
  }

  const dados = { id: usuario.id, nome: usuario.nome, email: usuario.email };
  const token = gerarToken(dados);

  return res.json({ token, usuario: dados });
});

function gerarToken(usuario) {
  return jwt.sign(usuario, process.env.JWT_SECRET, { expiresIn: '8h' });
}

module.exports = router;
