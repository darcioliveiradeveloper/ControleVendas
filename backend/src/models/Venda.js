const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    produto_id: { type: Number, required: true },
    produto_nome: { type: String, default: null },
    quantidade: { type: Number, required: true },
    preco_unitario: { type: Number, required: true },
    custo_unitario: { type: Number, default: 0 },
  },
  { _id: true, toJSON: { virtuals: true } }
);

const parcelaSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true },
    valor: { type: Number, required: true },
    data_vencimento: { type: String, required: true },
    pago: { type: Boolean, default: false },
    data_pagamento: { type: String, default: null },
  },
  { _id: true, toJSON: { virtuals: true } }
);

const schema = new mongoose.Schema(
  {
    _id: { type: Number },
    cliente_id: { type: Number, default: null },
    cliente_nome: { type: String, default: null },
    tipo: { type: String, enum: ['venda', 'encomenda'], default: 'venda' },
    forma_pagamento: { type: String, enum: ['a_vista', 'parcelado'], default: 'a_vista' },
    total: { type: Number, default: 0 },
    status: { type: String, enum: ['ativa', 'cancelada'], default: 'ativa' },
    itens: { type: [itemSchema], default: [] },
    parcelas: { type: [parcelaSchema], default: [] },
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

schema.index({ status: 1 });
schema.index({ tipo: 1 });
schema.index({ criado_em: 1 });

module.exports = mongoose.model('Venda', schema);
