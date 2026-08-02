const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    _id: { type: Number },
    nome: { type: String, required: true, trim: true },
    endereco: { type: String, default: null },
    telefone: { type: String, default: null },
    criado_em: { type: String, default: null },
    atualizado_em: { type: String, default: null },
  },
  {
    id: false,
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

schema.index({ nome: 1 });

module.exports = mongoose.model('Cliente', schema);
