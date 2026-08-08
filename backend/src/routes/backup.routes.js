const express = require('express');
const autenticar = require('../middleware/auth');
const { backupBanco, publicarBackupGitHub } = require('../backup');
const { PASTA_DB } = require('../config');

const router = express.Router();

router.use(autenticar);

router.post('/', async (req, res) => {
  try {
    const { caminho, nomeArquivo } = await backupBanco();
    let github = null;
    if (process.env.GITHUB_TOKEN) {
      github = await publicarBackupGitHub(nomeArquivo);
    }
    res.json({ sucesso: true, arquivo: caminho, pasta: PASTA_DB, github });
  } catch (e) {
    res.status(500).json({ erro: 'Falha ao gerar backup: ' + e.message });
  }
});

module.exports = router;
