const os = require('os');
const path = require('path');
const fs = require('fs');

const E_LOCAL = !process.env.RENDER;

function pastaBackupPadrao() {
  const home = os.homedir();
  const candidatos = [
    path.join(home, 'Downloads'),
    path.join(home, 'Documentos'),
    path.join(home, 'Desktop'),
    home,
  ];
  for (const candidato of candidatos) {
    try {
      fs.mkdirSync(candidato, { recursive: true });
      const destino = path.join(candidato, 'ControledeVendas');
      fs.mkdirSync(destino, { recursive: true });
      return destino;
    } catch (e) {
      // tenta o próximo candidato
    }
  }
  return path.join(__dirname, '..', '..', 'backup', 'ControledeVendas');
}

const PASTA_BACKUP = process.env.PASTA_BACKUP || pastaBackupPadrao();
const PASTA_IMAGENS = E_LOCAL ? path.join(PASTA_BACKUP, 'IMG') : path.join(__dirname, '..', 'uploads');
const PASTA_DB = path.join(PASTA_BACKUP, 'DB');

function garantirPastasBackup() {
  fs.mkdirSync(PASTA_IMAGENS, { recursive: true });
  fs.mkdirSync(PASTA_DB, { recursive: true });
  if (E_LOCAL) {
    const uploadsAntigos = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsAntigos) && uploadsAntigos !== PASTA_IMAGENS) {
      try {
        for (const arquivo of fs.readdirSync(uploadsAntigos)) {
          const origem = path.join(uploadsAntigos, arquivo);
          const destino = path.join(PASTA_IMAGENS, arquivo);
          if (fs.statSync(origem).isFile() && !fs.existsSync(destino)) {
            fs.copyFileSync(origem, destino);
          }
        }
      } catch (e) {
        console.error('Falha ao migrar imagens antigas:', e.message);
      }
    }
  }
  return { PASTA_BACKUP, PASTA_DB, PASTA_IMAGENS };
}

module.exports = { E_LOCAL, PASTA_BACKUP, PASTA_IMAGENS, PASTA_DB, garantirPastasBackup };
