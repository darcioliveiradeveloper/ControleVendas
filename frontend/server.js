const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = process.env.PORT || 8080;
const RAIZ = __dirname;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

http
  .createServer((req, res) => {
    let caminho = decodeURIComponent(req.url.split('?')[0]);
    if (caminho === '/') caminho = '/index.html';

    const arquivo = path.join(RAIZ, caminho);
    if (!arquivo.startsWith(RAIZ)) {
      res.writeHead(403);
      return res.end('Proibido');
    }

    fs.readFile(arquivo, (erro, dados) => {
      if (erro) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Arquivo nao encontrado: ' + caminho);
      }
      const tipo = TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': tipo });
      res.end(dados);
    });
  })
  .listen(PORTA, '0.0.0.0', () => {
    console.log(`Frontend rodando em http://localhost:${PORTA}`);
    console.log('Acesse pelo celular usando o IP desta maquina.');
  });
