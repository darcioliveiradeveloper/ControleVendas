const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    _id: { type: Number },
    produto_id: { type: Number, required: true },
    produto_nome: { type: String, default: null },
    tipo: { type: String, enum: ['entrada', 'saida'], required: true },
    quantidade: { type: Number, required: true },
    custo_unitario: { type: Number, default: null },
    estoque_antes: { type: Number, default: null },
    estoque_depois: { type: Number, default: null },
    custo_antigo: { type: Number, default: null },
    custo_novo: { type: Number, default: null },
    variacao_valor: { type: Number, default: null },
    observacao: { type: String, default: null },
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

schema.index({ produto_id: 1 });
schema.index({ tipo: 1 });

module.exports = mongoose.model('MovimentoEstoque', schema);
