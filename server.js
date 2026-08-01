require('dotenv').config();
const express = require('express');
const path = require('path');
const autenticar = require('./src/middleware/auth');
const authRoutes = require('./src/routes/auth.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);

app.get('/api/me', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', banco: 'sqlite', etapa: 1 });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log('Acesse pelo celular na mesma rede usando o IP desta maquina.');
});
