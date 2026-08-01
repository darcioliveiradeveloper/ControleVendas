const $ = (id) => document.getElementById(id);

let carrinho = [];
let vendaSelecionada = null;

// ---- Carrinho ---------------------------------------------------------------

function adicionarAoCarrinho(produto) {
  const tipo = $('v-tipo').value;
  const existente = carrinho.find((i) => i.produto_id === produto.id);

  if (existente) {
    if (tipo === 'venda' && existente.quantidade + 1 > produto.estoque) {
      alert(`Estoque insuficiente de "${produto.nome}". Disponível: ${produto.estoque}.`);
      return;
    }
    existente.quantidade += 1;
  } else {
    if (tipo === 'venda' && produto.estoque <= 0) {
      alert(`O produto "${produto.nome}" está sem estoque.`);
      return;
    }
    carrinho.push({
      produto_id: produto.id,
      nome: produto.nome,
      quantidade: 1,
      preco_unitario: produto.preco_venda,
      estoque_disponivel: produto.estoque,
    });
  }

  renderizarCarrinho();
  $('v-busca-produto').value = '';
  $('resultado-produtos').classList.add('hidden');
}

function removerDoCarrinho(indice) {
  carrinho.splice(indice, 1);
  renderizarCarrinho();
}

function renderizarCarrinho() {
  const corpo = $('corpo-carrinho');
  if (!carrinho.length) {
    corpo.innerHTML = '<tr><td colspan="5" class="vazio">Nenhum produto no carrinho.</td></tr>';
  } else {
    corpo.innerHTML = '';
    carrinho.forEach((item, indice) => {
      const tr = document.createElement('tr');
      const subtotal = item.preco_unitario * item.quantidade;
      tr.innerHTML =
        `<td><strong>${escapar(item.nome)}</strong></td>` +
        `<td><input type="number" class="quantidade-input" min="1" value="${item.quantidade}" data-indice="${indice}" /></td>` +
        `<td>${formatarMoeda(item.preco_unitario)}</td>` +
        `<td class="subtotal">${formatarMoeda(subtotal)}</td>` +
        `<td class="acoes"><button class="btn excluir small-btn">Remover</button></td>`;
      corpo.appendChild(tr);
    });
  }

  const total = carrinho.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0);
  $('v-total').textContent = formatarMoeda(total);
}

$('corpo-carrinho').addEventListener('input', (evento) => {
  const input = evento.target;
  if (!input.classList.contains('quantidade-input')) return;
  const indice = Number(input.dataset.indice);
  const qtd = parseInt(input.value, 10);
  const item = carrinho[indice];
  const tipo = $('v-tipo').value;

  if (tipo === 'venda' && qtd > item.estoque_disponivel) {
    alert(`Estoque insuficiente de "${item.nome}". Disponível: ${item.estoque_disponivel}.`);
    input.value = Math.min(item.quantidade, item.estoque_disponivel) || 1;
    return;
  }

  if (!qtd || qtd < 1) {
    input.value = 1;
    item.quantidade = 1;
  } else {
    item.quantidade = qtd;
  }
  renderizarCarrinho();
});

$('corpo-carrinho').addEventListener('click', (evento) => {
  const botao = evento.target.closest('.btn.excluir');
  if (!botao) return;
  const tr = botao.closest('tr');
  const indice = Array.from(tr.parentNode.children).indexOf(tr);
  removerDoCarrinho(indice);
});

// ---- Busca de cliente ---------------------------------------------------------

let debounceCliente = null;
$('v-busca-cliente').addEventListener('input', () => {
  clearTimeout(debounceCliente);
  const termo = $('v-busca-cliente').value.trim();
  if (termo.length < 2) {
    $('resultado-clientes').classList.add('hidden');
    return;
  }
  debounceCliente = setTimeout(async () => {
    try {
      const clientes = await requisicaoJSON(`${API}/clientes?busca=${encodeURIComponent(termo)}`, 'GET', null, obterToken());
      renderizarClientes(clientes);
    } catch (erro) {
      alert(erro.message);
    }
  }, 300);
});

function renderizarClientes(clientes) {
  const div = $('resultado-clientes');
  div.innerHTML = '';
  div.classList.remove('hidden');

  if (!clientes.length) {
    div.innerHTML = '<div class="item-busca sem-resultado">Nenhum cliente encontrado.</div>';
    return;
  }

  clientes.forEach((cliente) => {
    const item = document.createElement('div');
    item.className = 'item-busca';
    item.innerHTML =
      '<div>' +
      '<div class="nome">' + escapar(cliente.nome) + '</div>' +
      '<div class="detalhe">' + escapar(cliente.telefone || 'sem telefone') + '</div>' +
      '</div>';
    item.addEventListener('click', () => {
      $('v-cliente-id').value = cliente.id;
      $('v-busca-cliente').value = cliente.nome;
      $('resultado-clientes').classList.add('hidden');
    });
    div.appendChild(item);
  });
}

// ---- Busca de produto -----------------------------------------------------------

let debounceProduto = null;
$('v-busca-produto').addEventListener('input', () => {
  clearTimeout(debounceProduto);
  const termo = $('v-busca-produto').value.trim();
  if (termo.length < 2) {
    $('resultado-produtos').classList.add('hidden');
    return;
  }
  debounceProduto = setTimeout(async () => {
    try {
      const produtos = await requisicaoJSON(`${API}/produtos?busca=${encodeURIComponent(termo)}`, 'GET', null, obterToken());
      renderizarProdutos(produtos);
    } catch (erro) {
      alert(erro.message);
    }
  }, 300);
});

function renderizarProdutos(produtos) {
  const div = $('resultado-produtos');
  div.innerHTML = '';
  div.classList.remove('hidden');

  if (!produtos.length) {
    div.innerHTML = '<div class="item-busca sem-resultado">Nenhum produto encontrado.</div>';
    return;
  }

  produtos.slice(0, 8).forEach((produto) => {
    const item = document.createElement('div');
    item.className = 'item-busca';
    item.innerHTML =
      '<div>' +
      '<div class="nome">' + escapar(produto.nome) + '</div>' +
      '<div class="detalhe">Estoque: ' + produto.estoque + '</div>' +
      '</div>' +
      '<span class="preco">' + formatarMoeda(produto.preco_venda) + '</span>';
    item.addEventListener('click', () => adicionarAoCarrinho(produto));
    div.appendChild(item);
  });
}

// ---- Tipo / pagamento ------------------------------------------------------------

$('v-tipo').addEventListener('change', () => {
  $('resultado-produtos').classList.add('hidden');
});

$('v-pagamento').addEventListener('change', () => {
  const parcelado = $('v-pagamento').value === 'parcelado';
  $('campo-parcelas').classList.toggle('hidden', !parcelado);
  $('campo-pago').classList.toggle('hidden', parcelado);
});

// ---- Finalizar venda --------------------------------------------------------------

function mostrarMensagem(texto, tipo) {
  const el = $('msg-venda');
  el.textContent = texto;
  el.className = 'mensagem ' + tipo;
  el.classList.remove('hidden');
  if (tipo === 'sucesso') {
    setTimeout(() => el.classList.add('hidden'), 4000);
  }
}

$('form-venda').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  if (!carrinho.length) {
    mostrarMensagem('Adicione pelo menos um produto.', 'erro');
    return;
  }

  const botao = $('btn-finalizar');
  botao.disabled = true;

  try {
    const corpo = {
      cliente_id: $('v-cliente-id').value || null,
      tipo: $('v-tipo').value,
      forma_pagamento: $('v-pagamento').value,
      numero_parcelas: $('v-num-parcelas').value || '1',
      data_primeira_parcela: $('v-data-primeira').value || null,
      pago: $('v-pago').checked,
      itens: carrinho.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
    };

    const venda = await requisicaoJSON(`${API}/vendas`, 'POST', corpo, obterToken());

    carrinho = [];
    renderizarCarrinho();
    evento.target.reset();
    $('v-pago').checked = true;
    $('v-cliente-id').value = '';
    $('campo-parcelas').classList.add('hidden');

    const nomeTipo = venda.tipo === 'encomenda' ? 'Encomenda' : 'Venda';
    mostrarMensagem(`${nomeTipo} registrada com sucesso!`, 'sucesso');
    await carregarVendas();
    abrirModal(venda.id);
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  } finally {
    botao.disabled = false;
  }
});

// ---- Lista de vendas --------------------------------------------------------------

async function carregarVendas() {
  const corpo = $('corpo-vendas');
  corpo.innerHTML = '<tr><td colspan="7" class="vazio">Carregando vendas...</td></tr>';

  try {
    const status = $('filtro-status-vendas').value;
    const url = status ? `${API}/vendas?status=${status}` : `${API}/vendas`;
    const vendas = await requisicaoJSON(url, 'GET', null, obterToken());

    if (!vendas.length) {
      corpo.innerHTML = '<tr><td colspan="7" class="vazio">Nenhuma venda registrada.</td></tr>';
      return;
    }

    corpo.innerHTML = '';
    vendas.forEach((venda) => corpo.appendChild(criarLinhaVenda(venda)));
  } catch (erro) {
    corpo.innerHTML = `<tr><td colspan="7" class="vazio">${escapar(erro.message)}</td></tr>`;
  }
}

function criarLinhaVenda(venda) {
  const tr = document.createElement('tr');
  const cancelada = venda.status === 'cancelada';
  const tipoLabel = venda.tipo === 'encomenda' ? 'Encomenda' : 'Venda';

  let pagamentoHtml;
  if (cancelada) {
    pagamentoHtml = '<span class="badge saida">Cancelada</span>';
  } else if (venda.forma_pagamento === 'parcelado') {
    const pagas = Number(venda.parcelas_pagas) || 0;
    const total = Number(venda.total_parcelas) || 0;
    pagamentoHtml = `<span class="badge ${pagas >= total ? 'entrada' : 'pendencia'}">${pagas}/${total} pagas</span>`;
  } else if (Number(venda.valor_pago) >= Number(venda.total)) {
    pagamentoHtml = '<span class="badge entrada">Pago</span>';
  } else {
    pagamentoHtml = '<span class="badge pendencia">Em aberto</span>';
  }

  tr.innerHTML =
    `<td class="data">${escapar(formatarData(venda.criado_em))}</td>` +
    `<td>${escapar(venda.cliente_nome || 'Sem cliente')}</td>` +
    `<td>${tipoLabel}</td>` +
    `<td>${venda.total_itens}</td>` +
    `<td><strong>${formatarMoeda(venda.total)}</strong></td>` +
    `<td>${pagamentoHtml}</td>` +
    `<td class="acoes"><button class="btn editar small-btn">Detalhes</button></td>`;

  tr.querySelector('button').addEventListener('click', () => abrirModal(venda.id));
  return tr;
}

$('filtro-status-vendas').addEventListener('change', carregarVendas);

// ---- Modal -------------------------------------------------------------------------

function abrirModal(id) {
  $('modal-venda').classList.remove('hidden');
  $('modal-corpo').innerHTML = '<div class="vazio">Carregando...</div>';
  $('modal-titulo').textContent = 'Venda #' + id;

  carregarDetalhe(id).catch((erro) => {
    $('modal-corpo').innerHTML = '<div class="vazio">' + escapar(erro.message) + '</div>';
  });
}

async function carregarDetalhe(id) {
  const venda = await requisicaoJSON(`${API}/vendas/${id}`, 'GET', null, obterToken());
  vendaSelecionada = venda;
  renderizarDetalhe(venda);
}

function renderizarDetalhe(venda) {
  const corpo = $('modal-corpo');
  const tipoLabel = venda.tipo === 'encomenda' ? 'Encomenda' : 'Venda';
  const formaLabel = venda.forma_pagamento === 'parcelado' ? 'Parcelado' : 'À vista';

  let itensHtml = '';
  venda.itens.forEach((item) => {
    itensHtml +=
      '<tr>' +
      `<td>${escapar(item.produto_nome)}</td>` +
      `<td>${item.quantidade} x ${formatarMoeda(item.preco_unitario)}</td>` +
      `<td class="acoes">${formatarMoeda(item.quantidade * item.preco_unitario)}</td>` +
      '</tr>';
  });

  let parcelasHtml = '';
  venda.parcelas.forEach((parcela) => {
    const paga = parcela.pago === 1;
    parcelasHtml +=
      '<tr>' +
      `<td>${parcela.numero}ª parcela</td>` +
      `<td>${formatarMoeda(parcela.valor)}</td>` +
      `<td>${escapar(formatarData(parcela.data_vencimento))}</td>` +
      `<td>${paga ? '<span class="parcela-paga">Pago</span>' : '<span class="parcela-pendente">Pendente</span>'}</td>` +
      `<td class="acoes"><button class="btn ${paga ? 'pago' : 'pagar'}" data-parcela="${parcela.id}">${paga ? 'Marcar não pago' : 'Marcar pago'}</button></td>` +
      '</tr>';
  });

  const cancelada = venda.status === 'cancelada';
  let acoesHtml = '';
  if (!cancelada) {
    if (venda.tipo === 'encomenda') {
      acoesHtml += '<button class="btn primary" id="btn-confirmar-encomenda">Confirmar encomenda (dar baixa no estoque)</button>';
    }
    acoesHtml += '<button class="btn excluir" id="btn-cancelar-venda">Cancelar venda (devolver estoque)</button>';
  }

  corpo.innerHTML =
    '<div class="detalhe-cabecalho">' +
    '<div><div class="rotulo">Cliente</div><div class="valor">' + escapar(venda.cliente_nome || 'Sem cliente') + '</div></div>' +
    '<div><div class="rotulo">Tipo</div><div class="valor">' + tipoLabel + '</div></div>' +
    '<div><div class="rotulo">Pagamento</div><div class="valor">' + formaLabel + '</div></div>' +
    '<div><div class="rotulo">Total</div><div class="valor">' + formatarMoeda(venda.total) + '</div></div>' +
    '<div><div class="rotulo">Data</div><div class="valor">' + escapar(formatarData(venda.criado_em)) + '</div></div>' +
    '</div>' +
    '<h3>Itens</h3>' +
    '<div class="table-wrapper"><table class="tabela">' +
    '<thead><tr><th>Produto</th><th>Quantidade</th><th>Subtotal</th></tr></thead>' +
    '<tbody>' + itensHtml + '</tbody></table></div>' +
    '<h3>Parcelas</h3>' +
    '<div class="table-wrapper"><table class="tabela">' +
    '<thead><tr><th>Parcela</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead>' +
    '<tbody>' + (parcelasHtml || '<tr><td colspan="5" class="vazio">Sem parcelas.</td></tr>') + '</tbody></table></div>' +
    '<div class="modal-acoes">' + acoesHtml + '</div>';

  if (!cancelada) {
    corpo.querySelectorAll('.btn[data-parcela]').forEach((botao) => {
      botao.addEventListener('click', () => alternarPagamentoParcela(Number(botao.dataset.parcela)));
    });
    const confirmar = corpo.querySelector('#btn-confirmar-encomenda');
    if (confirmar) confirmar.addEventListener('click', () => confirmarEncomenda(venda.id));
    const cancelar = corpo.querySelector('#btn-cancelar-venda');
    if (cancelar) cancelar.addEventListener('click', () => cancelarVenda(venda.id));
  }
}

async function alternarPagamentoParcela(parcelaId) {
  const venda = vendaSelecionada;
  const parcela = venda.parcelas.find((p) => p.id === parcelaId);
  const pago = parcela.pago !== 1;

  try {
    await requisicaoJSON(`${API}/vendas/${venda.id}/parcelas/${parcelaId}`, 'PUT', { pago }, obterToken());
    await carregarDetalhe(venda.id);
    await carregarVendas();
  } catch (erro) {
    alert(erro.message);
  }
}

async function confirmarEncomenda(id) {
  if (!confirm('Confirmar a encomenda? O estoque dos produtos será baixado.')) return;
  try {
    const venda = await requisicaoJSON(`${API}/vendas/${id}/confirmar`, 'POST', null, obterToken());
    mostrarMensagem('Encomenda confirmada e estoque baixado!', 'sucesso');
    await carregarDetalhe(venda.id);
    await carregarVendas();
  } catch (erro) {
    alert(erro.message);
  }
}

async function cancelarVenda(id) {
  if (!confirm('Cancelar esta venda? O estoque será devolvido.')) return;
  try {
    const venda = await requisicaoJSON(`${API}/vendas/${id}`, 'DELETE', null, obterToken());
    mostrarMensagem('Venda cancelada e estoque devolvido.', 'sucesso');
    await carregarDetalhe(venda.id);
    await carregarVendas();
  } catch (erro) {
    alert(erro.message);
  }
}

$('btn-fechar-modal').addEventListener('click', () => $('modal-venda').classList.add('hidden'));
$('modal-venda').addEventListener('click', (evento) => {
  if (evento.target === evento.currentTarget) {
    $('modal-venda').classList.add('hidden');
  }
});

// ---- Formatadores ----------------------------------------------------------------

function formatarData(data) {
  if (!data) return '—';
  const parte = String(data).slice(0, 10).split('-');
  if (parte.length !== 3) return data;
  return parte[2] + '/' + parte[1] + '/' + parte[0];
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// ---- Início -------------------------------------------------------------------------

carregarVendas();
