const mongoose = require('mongoose');

function conectarBanco() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Defina MONGODB_URI no arquivo .env (string de conexão do MongoDB).');
  }
  mongoose.set('strictQuery', true);
  return mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
}

module.exports = { conectarBanco };
