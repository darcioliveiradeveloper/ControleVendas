const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { PASTA_DB } = require('./config');

function carimboData() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

async function backupBanco() {
  const nomes = await mongoose.connection.db.listCollections().toArray();
  const dados = {};
  for (const c of nomes) {
    if (c.name.startsWith('system.')) continue;
    dados[c.name] = await mongoose.connection.db.collection(c.name).find({}).toArray();
  }
  const nomeArquivo = `backup-${carimboData()}.json`;
  const caminho = path.join(PASTA_DB, nomeArquivo);
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), 'utf8');
  return { caminho, nomeArquivo };
}

const REPO_PADRAO = 'darcioliveiradeveloper/ControleVendas';

async function publicarBackupGitHub(nomeArquivo) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || REPO_PADRAO;
  if (!token) return null;
  const conteudo = fs.readFileSync(path.join(PASTA_DB, nomeArquivo), 'utf8');
  const caminhoRepo = `backup/${nomeArquivo}`;
  const resposta = await fetch(`https://api.github.com/repos/${repo}/contents/${caminhoRepo}`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'User-Agent': 'ControleVendas',
    },
    body: JSON.stringify({
      message: `Backup ${nomeArquivo}`,
      content: Buffer.from(conteudo).toString('base64'),
    }),
  });
  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Falha ao publicar no GitHub (${resposta.status}): ${texto.slice(0, 300)}`);
  }
  const dados = await resposta.json();
  return dados && dados.content && dados.content.html_url ? dados.content.html_url : `https://github.com/${repo}/tree/main/backup`;
}

module.exports = { backupBanco, publicarBackupGitHub, carimboData };
