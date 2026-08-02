const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    sequencia: { type: Number, default: 0 },
  },
  {
    id: false,
    versionKey: false,
    collection: 'contadores',
  }
);

module.exports = mongoose.model('Contador', schema);
