const Contador = require('./models/Contador');

async function proximoId(nomeColecao) {
  const doc = await Contador.findByIdAndUpdate(
    nomeColecao,
    { $inc: { sequencia: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc.sequencia;
}

module.exports = { proximoId };
