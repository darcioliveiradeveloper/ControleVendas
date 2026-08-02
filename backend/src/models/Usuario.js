const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    _id: { type: Number },
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senha_hash: { type: String, required: true },
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

module.exports = mongoose.model('Usuario', schema);
