require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { conectarBanco } = require('./src/mongoose');
const autenticar = require('./src/middleware/auth');
const authRoutes = require('./src/routes/auth.routes');
const produtosRoutes = require('./src/routes/produtos.routes');
const estoqueRoutes = require('./src/routes/estoque.routes');
const clientesRoutes = require('./src/routes/clientes.routes');
const vendasRoutes = require('./src/routes/vendas.routes');
const relatoriosRoutes = require('./src/routes/relatorios.routes');

const app = express();
const PORT = process.env.PORT || 3000;
const frontendDir = path.join(__dirname, '..', 'frontend');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(frontendDir));

app.use('/api/auth', authRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/estoque', estoqueRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/vendas', vendasRoutes);
app.use('/api/relatorios', relatoriosRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.get('/api/me', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', banco: 'mongodb', etapa: 8 });
});

app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
    return res.sendFile(path.join(frontendDir, 'index.html'));
  }
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

async function iniciar() {
  try {
    await conectarBanco();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
      console.log('Acesse pelo celular na mesma rede usando o IP desta maquina.');
    });
  } catch (erro) {
    console.error('Falha ao conectar ao MongoDB:', erro.message);
    process.exit(1);
  }
}

iniciar();
