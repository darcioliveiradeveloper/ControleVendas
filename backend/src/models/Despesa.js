const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    _id: { type: Number },
    descricao: { type: String, required: true, trim: true },
    valor: { type: Number, required: true },
    categoria: { type: String, default: null },
    data: { type: String, required: true },
    criado_em: { type: String, default: null },
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

schema.index({ data: 1 });

module.exports = mongoose.model('Despesa', schema);
