const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { PASTA_IMAGENS } = require('./config');

const BUCKET = 'produto_fotos';

function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
}

function salvarFoto(buffer, contentType) {
  return new Promise((resolve, reject) => {
    const nome = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const stream = bucket().openUploadStream(nome, { contentType: contentType || 'image/jpeg' });
    stream.on('error', reject);
    stream.on('finish', () => resolve(stream.id.toString()));
    const dados = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    Readable.from([dados]).pipe(stream);
  });
}

function servirFoto(id, res) {
  const oid = new mongoose.Types.ObjectId(String(id));
  bucket()
    .find({ _id: oid })
    .toArray((erro, arquivos) => {
      if (erro || !arquivos || !arquivos.length) {
        return res.status(404).json({ erro: 'Imagem não encontrada.' });
      }
      res.set('Content-Type', arquivos[0].contentType || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      bucket()
        .openDownloadStream(oid)
        .pipe(res);
    });
}

async function removerFotoId(id) {
  if (!id) return;
  try {
    await bucket().delete(new mongoose.Types.ObjectId(String(id)));
  } catch (e) {
    // arquivo já não existe
  }
}

function extensaoParaTipo(nome) {
  const ext = path.extname(String(nome)).toLowerCase();
  const mapa = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  return mapa[ext] || 'image/jpeg';
}

async function migrarFotosAntigas() {
  const Produto = require('./models/Produto');
  const uploadsLegado = path.join(__dirname, '..', '..', 'uploads');
  const produtos = await Produto.find({ foto: /^\/uploads\// });
  let migradas = 0;
  for (const p of produtos) {
    const nomeArquivo = path.basename(p.foto);
    const emImagens = path.join(PASTA_IMAGENS, nomeArquivo);
    const emLegado = path.join(uploadsLegado, nomeArquivo);
    const caminho = fs.existsSync(emImagens) ? emImagens : fs.existsSync(emLegado) ? emLegado : null;
    if (!caminho) continue;
    try {
      const id = await salvarFoto(fs.readFileSync(caminho), extensaoParaTipo(nomeArquivo));
      p.foto = '/api/fotos/' + id;
      await p.save();
      migradas++;
    } catch (e) {
      console.error(`Erro ao migrar a foto de "${p.nome}":`, e.message);
    }
  }
  if (migradas) console.log(`Migradas ${migradas} foto(s) antigas para a nuvem.`);
}

module.exports = { salvarFoto, servirFoto, removerFotoId, migrarFotosAntigas };
