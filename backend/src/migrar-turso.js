require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@libsql/client');
const { migrar: criarSchema } = require('./db');

if (!process.env.TURSO_URL || !process.env.TURSO_TOKEN) {
  console.error('Defina TURSO_URL e TURSO_TOKEN no .env antes de migrar os dados.');
  process.exit(1);
}

const local = new Database(path.join(__dirname, '..', 'database.db'));
const turso = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

const TABELAS = [
  'usuarios',
  'produtos',
  'movimentos_estoque',
  'clientes',
  'vendas',
  'venda_itens',
  'parcelas',
];

async function copiarDados() {
  await criarSchema();

  for (const tabela of TABELAS) {
    const linhas = local.prepare(`SELECT * FROM ${tabela} ORDER BY id`).all();
    if (!linhas.length) {
      console.log(`${tabela}: 0 linhas`);
      continue;
    }

    const colunas = Object.keys(linhas[0]);
    const sql = `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`;

    const tx = await turso.transaction();
    try {
      for (const linha of linhas) {
        await tx.execute({ sql, args: colunas.map((c) => linha[c]) });
      }
      await tx.commit();
      console.log(`${tabela}: ${linhas.length} linhas copiadas`);
    } catch (erro) {
      try {
        await tx.rollback();
      } catch {}
      throw erro;
    }
  }
}

copiarDados()
  .then(() => console.log('Migracao concluida.'))
  .catch((erro) => {
    console.error('Falha na migracao:', erro);
    process.exit(1);
  });
