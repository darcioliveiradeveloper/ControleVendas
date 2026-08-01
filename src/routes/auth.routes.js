const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

router.post('/registrar', (req, res) => {
  const { nome, email, senha } = req.body || {};

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios.' });
  }

  const emailNormalizado = String(email).trim().toLowerCase();

  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(emailNormalizado);
  if (existe) {
    return res.status(409).json({ erro: 'Já existe uma conta com este email.' });
  }

  const senhaHash = bcrypt.hashSync(String(senha), 10);

  const resultado = db
    .prepare('INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)')
    .run(nome.trim(), emailNormalizado, senhaHash);

  const usuario = {
    id: resultado.lastInsertRowid,
    nome: nome.trim(),
    email: emailNormalizado,
  };

  const token = gerarToken(usuario);

  return res.status(201).json({ token, usuario });
});

router.post('/login', (req, res) => {
  const { email, senha } = req.body || {};

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
  }

  const emailNormalizado = String(email).trim().toLowerCase();
  const usuario = db
    .prepare('SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?')
    .get(emailNormalizado);

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
