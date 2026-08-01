const $ = (id) => document.getElementById(id);

function mostrarMensagem(texto, tipo) {
  const el = $('msg-estoque');
  el.textContent = texto;
  el.className = 'mensagem ' + tipo;
  el.classList.remove('hidden');
  if (tipo === 'sucesso') {
    setTimeout(() => el.classList.add('hidden'), 3500);
  }
}

// ---- Produtos no select ---------------------------------------------------

async function carregarProdutosSelect() {
  const select = $('m-produto');
  select.innerHTML = '<option value="">Carregando...</option>';

  try {
    const produtos = await requisicaoJSON(`${API}/produtos`, 'GET', null, obterToken());
    select.innerHTML = '<option value="">Selecione...</option>';
    produtos.forEach((produto) => {
      const opcao = document.createElement('option');
      opcao.value = produto.id;
      opcao.textContent = `${produto.nome} (estoque: ${produto.estoque})`;
      select.appendChild(opcao);
    });
  } catch (erro) {
    select.innerHTML = '<option value="">Erro ao carregar produtos</option>';
    alert(erro.message);
  }
}

// ---- Campo custo + estoque atual -------------------------------------------

$('m-tipo').addEventListener('change', atualizarCampoCusto);

async function atualizarCampoCusto() {
  const tipo = $('m-tipo').value;
  const ajuda = $('ajuda-custo');

  if (tipo === 'entrada') {
    $('campo-custo').classList.remove('hidden');
    ajuda.textContent = 'Ao informar o custo, o preço de custo e o preço de venda do produto são atualizados.';
  } else {
    $('campo-custo').classList.add('hidden');
    ajuda.textContent = '';
  }
}

$('m-produto').addEventListener('change', async () => {
  const id = $('m-produto').value;
  if (!id) return;
  const tipo = $('m-tipo').value;
  if (tipo !== 'entrada') return;
  try {
    const produto = await requisicaoJSON(`${API}/produtos/${id}`, 'GET', null, obterToken());
    $('ajuda-custo').textContent = `Custo atual: ${formatarMoeda(produto.preco_custo)} · Venda atual: ${formatarMoeda(produto.preco_venda)}`;
  } catch (erro) {
    $('ajuda-custo').textContent = '';
  }
});

// ---- Registrar movimento ----------------------------------------------------

$('form-movimento').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const botao = $('btn-movimento');
  botao.disabled = true;

  try {
    const corpo = {
      produto_id: $('m-produto').value,
      tipo: $('m-tipo').value,
      quantidade: $('m-quantidade').value,
      observacao: $('m-observacao').value,
    };
    if (corpo.tipo === 'entrada' && $('m-custo').value) {
      corpo.custo_unitario = $('m-custo').value;
    }

    const dados = await requisicaoJSON(`${API}/estoque/movimentos`, 'POST', corpo, obterToken());

    const acao = corpo.tipo === 'entrada' ? 'entrada registrada' : 'saída registrada';
    mostrarMensagem(`${acao} com sucesso. Estoque atual: ${dados.estoque_atual}.`, 'sucesso');

    evento.target.reset();
    atualizarCampoCusto();
    await carregarProdutosSelect();
    await carregarMovimentos();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  } finally {
    botao.disabled = false;
  }
});

// ---- Histórico ---------------------------------------------------------------

async function carregarMovimentos() {
  const corpo = $('corpo-movimentos');

  try {
    const filtro = $('filtro-movimento').value.trim();
    let url = `${API}/estoque/movimentos`;
    if (filtro) url += `?produto_id=${filtro}`;
    const movimentos = await requisicaoJSON(url, 'GET', null, obterToken());

    if (!movimentos.length) {
      corpo.innerHTML = '<tr><td colspan="7" class="vazio">Nenhuma movimentação registrada.</td></tr>';
      return;
    }

    corpo.innerHTML = '';
    movimentos.forEach((movimento) => corpo.appendChild(criarLinha(movimento)));
  } catch (erro) {
    corpo.innerHTML = `<tr><td colspan="7" class="vazio">${escapar(erro.message)}</td></tr>`;
  }
}

function criarLinha(movimento) {
  const tr = document.createElement('tr');
  const entrada = movimento.tipo === 'entrada';
  const custo = movimento.custo_unitario != null ? formatarMoeda(movimento.custo_unitario) : '—';

  tr.innerHTML =
    `<td class="data">${escapar(movimento.criado_em)}</td>` +
    `<td>${escapar(movimento.produto_nome)}</td>` +
    `<td><span class="badge ${entrada ? 'entrada' : 'saida'}">${entrada ? 'Entrada' : 'Saída'}</span></td>` +
    `<td>${entrada ? '+' : '−'}${movimento.quantidade}</td>` +
    `<td>${custo}</td>` +
    `<td>${escapar(movimento.observacao || '—')}</td>` +
    `<td class="acoes"><button class="btn excluir small-btn">Estornar</button></td>`;

  tr.querySelector('.btn').addEventListener('click', () => estornarMovimento(movimento));
  return tr;
}

async function estornarMovimento(movimento) {
  const acao = movimento.tipo === 'entrada' ? 'entrada' : 'saída';
  if (!confirm(`Estornar esta ${acao} de ${movimento.quantidade} unidade(s) de "${movimento.produto_nome}"?`)) return;

  try {
    await requisicaoJSON(`${API}/estoque/movimentos/${movimento.id}`, 'DELETE', null, obterToken());
    mostrarMensagem('Movimento estornado.', 'sucesso');
    await carregarProdutosSelect();
    await carregarMovimentos();
  } catch (erro) {
    alert(erro.message);
  }
}

$('filtro-movimento').addEventListener('input', async () => {
  const filtro = $('filtro-movimento').value.trim();
  if (!filtro) {
    await carregarMovimentos();
    return;
  }
  try {
    const produtos = await requisicaoJSON(`${API}/produtos?busca=${encodeURIComponent(filtro)}`, 'GET', null, obterToken());
    if (produtos.length) {
      const url = `${API}/estoque/movimentos?produto_id=${produtos[0].id}`;
      const movimentos = await requisicaoJSON(url, 'GET', null, obterToken());
      renderizarFiltrados(movimentos);
    } else {
      $('corpo-movimentos').innerHTML = '<tr><td colspan="7" class="vazio">Nenhum produto encontrado.</td></tr>';
    }
  } catch (erro) {
    $('corpo-movimentos').innerHTML = `<tr><td colspan="7" class="vazio">${escapar(erro.message)}</td></tr>`;
  }
});

function renderizarFiltrados(movimentos) {
  const corpo = $('corpo-movimentos');
  corpo.innerHTML = '';
  if (!movimentos.length) {
    corpo.innerHTML = '<tr><td colspan="7" class="vazio">Nenhuma movimentação para este produto.</td></tr>';
    return;
  }
  movimentos.forEach((movimento) => corpo.appendChild(criarLinha(movimento)));
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// ---- Início ---------------------------------------------------------------

atualizarCampoCusto();
carregarProdutosSelect();
carregarMovimentos();
