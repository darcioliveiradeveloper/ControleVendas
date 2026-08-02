const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const { proximoId } = require('../ids');
const { agoraLocal } = require('../utilidades');

const router = express.Router();

router.post('/registrar', async (req, res) => {
  const { nome, email, senha } = req.body || {};

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios.' });
  }

  const emailNormalizado = String(email).trim().toLowerCase();

  const existe = await Usuario.findOne({ email: emailNormalizado });
  if (existe) {
    return res.status(409).json({ erro: 'Já existe uma conta com este email.' });
  }

  const senhaHash = bcrypt.hashSync(String(senha), 10);

  const usuario = await Usuario.create({
    _id: await proximoId('usuarios'),
    nome: nome.trim(),
    email: emailNormalizado,
    senha_hash: senhaHash,
    criado_em: agoraLocal(),
  });

  const dados = { id: usuario._id, nome: usuario.nome, email: usuario.email };
  const token = gerarToken(dados);

  return res.status(201).json({ token, usuario: dados });
});

router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {};

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
  }

  const emailNormalizado = String(email).trim().toLowerCase();
  const usuario = await Usuario.findOne({ email: emailNormalizado });

  if (!usuario || !bcrypt.compareSync(String(senha), usuario.senha_hash)) {
    return res.status(401).json({ erro: 'Email ou senha incorretos.' });
  }

  const dados = { id: usuario._id, nome: usuario.nome, email: usuario.email };
  const token = gerarToken(dados);

  return res.json({ token, usuario: dados });
});

function gerarToken(usuario) {
  return jwt.sign(usuario, process.env.JWT_SECRET, { expiresIn: '8h' });
}

module.exports = router;
