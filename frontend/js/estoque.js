registrarTela('estoque', carregarTelaEstoque);

let produtosEstoque = [];
let movimentosAtuais = [];

async function carregarTelaEstoque() {
  const tela = document.getElementById('tela-estoque');
  tela.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <button class="btn primary" id="btn-novo-movimento">+ Movimento</button>
        <input id="busca-estoque" type="search" placeholder="Buscar produto..." autocomplete="off" />
      </div>
      <div class="sugestoes" id="sugestoes-estoque"></div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>Movimentos</h2>
        <select id="filtro-movimentos" style="width:auto;min-width:160px">
          <option value="">Todos os produtos</option>
        </select>
      </div>
      <div class="table-wrapper">
        <table class="tabela">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Estoque<br /><span class="th-sub">Antigo</span></th>
              <th>Custo<br /><span class="th-sub">Antigo</span></th>
              <th>Entrada</th>
              <th>Custo<br /><span class="th-sub">Atual</span></th>
              <th>Total<br /><span class="th-sub">Estoque</span></th>
              <th>Variação</th>
              <th class="acoes">Ações</th>
            </tr>
          </thead>
          <tbody id="corpo-movimentos"></tbody>
        </table>
      </div>
    </div>
  `;

  const busca = tela.querySelector('#busca-estoque');
  const sugestoes = tela.querySelector('#sugestoes-estoque');

  const renderSugestoes = () => {
    const termo = busca.value.trim().toLowerCase();
    const lista = termo
      ? produtosEstoque.filter(
          (p) =>
            (p.nome || '').toLowerCase().includes(termo) ||
            (p.marca || '').toLowerCase().includes(termo) ||
            (p.tipo || '').toLowerCase().includes(termo)
        )
      : produtosEstoque;

    sugestoes.innerHTML = lista.length
      ? lista
          .map(
            (p) => `
              <button type="button" class="sugestao" data-id="${p.id}">
                <span><strong>${p.nome}</strong>${p.marca ? ` <em>· ${p.marca}</em>` : ''}</span>
                <span class="sugestao-info">estoque: ${Number(p.estoque) || 0} · custo: ${formatarMoeda(p.preco_custo)}</span>
              </button>
            `
          )
          .join('')
      : `<div class="sugestao vazia">Nenhum produto encontrado.</div>`;
    sugestoes.style.display = 'block';
  };

  busca.addEventListener('input', renderSugestoes);
  busca.addEventListener('focus', renderSugestoes);
  busca.addEventListener('blur', () => setTimeout(() => (sugestoes.style.display = 'none'), 150));
  sugestoes.addEventListener('click', (e) => {
    const item = e.target.closest('.sugestao');
    if (!item || item.classList.contains('vazia')) return;
    abrirFormMovimento(Number(item.dataset.id));
    busca.value = '';
    sugestoes.style.display = 'none';
  });
  tela.querySelector('#btn-novo-movimento').addEventListener('click', () => abrirFormMovimento());
  tela.querySelector('#filtro-movimentos').addEventListener('change', (e) => carregarMovimentos(e.target.value));

  try {
    produtosEstoque = await requisicaoJSON(`${API()}/produtos`, 'GET', null, obterToken());
    tela.querySelector('#filtro-movimentos').innerHTML =
      `<option value="">Todos os produtos</option>` + produtosEstoque
        .map((p) => `<option value="${p.id}">${p.nome}</option>`)
        .join('');
  } catch (erro) {
    tratarErro(erro);
  }

  await carregarMovimentos('');
}

function badgeVariacao(variacao) {
  if (variacao == null || variacao === 0) return '—';
  if (variacao > 0) return `<span class="badge alta">Alta ${formatarMoeda(variacao)}</span>`;
  return `<span class="badge baixa">Baixa ${formatarMoeda(variacao)}</span>`;
}

function paraInputMoeda(valor) {
  const n = Number(valor);
  if (!isFinite(n) || n <= 0) return '';
  return n.toFixed(2).replace('.', ',');
}

function valorDoInputMoeda(input) {
  const t = String(input.value || '').replace(/[^\d,]/g, '');
  if (!t) return 0;
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

function aplicarMascaraMoeda(input, maximo) {
  const maxCentavos = Math.round(Number(maximo) * 100);
  input.addEventListener('input', () => {
    const digitos = String(input.value).replace(/\D/g, '').slice(0, 5);
    if (!digitos) {
      input.value = '';
      return;
    }
    let centavos = Number(digitos);
    if (centavos > maxCentavos) centavos = maxCentavos;
    const formatado = (centavos / 100).toFixed(2).replace('.', ',');
    if (input.value !== formatado) input.value = formatado;
  });
}

function abrirFormMovimento(produtoId, movimentoId) {
  const movimento = movimentoId ? movimentosAtuais.find((m) => m.id === Number(movimentoId)) : null;
  const editando = !!movimento;
  const produtoInicial = movimento
    ? produtosEstoque.find((p) => p.id === movimento.produto_id)
    : produtosEstoque.find((p) => p.id === Number(produtoId));

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-conteudo">
      <div class="modal-cabecalho">
        <h2>${editando ? 'Editar movimento' : 'Novo movimento'}</h2>
        <button class="modal-fechar" type="button">×</button>
      </div>
      <form id="form-movimento">
        <div class="linha-movimento">
          <div class="field campo-produto">
            <label>Produto *</label>
            <select name="produto_id" required>
              ${produtosEstoque
                .map((p) => `<option value="${p.id}" ${produtoInicial && p.id === produtoInicial.id ? 'selected' : ''}>${p.nome}</option>`)
                .join('')}
            </select>
          </div>
          <div class="field campo-qtd">
            <label>Qtd. *</label>
            <input name="quantidade" type="number" min="1" max="999" required value="${editando ? movimento.quantidade : ''}" />
          </div>
          <div class="field campo-custo-novo">
            <label>Custo (R$)</label>
            <input name="custo_novo" type="text" inputmode="decimal" maxlength="6" value="${editando && movimento.custo_novo != null ? paraInputMoeda(movimento.custo_novo) : ''}" />
          </div>
          <div class="field campo-data">
            <label>Data</label>
            <input type="text" value="${new Date().toLocaleDateString('pt-BR')}" readonly />
          </div>
        </div>
        <div class="preview-movimento" id="preview-movimento"></div>
        <div class="form-actions">
          <button type="submit" class="btn primary">Salvar</button>
          <button type="button" class="btn secondary modal-cancelar">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  const fechar = () => modal.remove();
  modal.querySelector('.modal-fechar').addEventListener('click', fechar);
  modal.querySelector('.modal-cancelar').addEventListener('click', fechar);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) fechar();
  });

  const inputCustoNovo = modal.querySelector('input[name="custo_novo"]');
  const inputQuantidade = modal.querySelector('input[name="quantidade"]');
  const selectProduto = modal.querySelector('select[name="produto_id"]');
  const preview = modal.querySelector('#preview-movimento');

  const produtoSelecionado = () => produtosEstoque.find((x) => x.id === Number(selectProduto.value));

  const atualizarCustos = () => {
    const p = produtoSelecionado();
    const custoAtual = p ? Number(p.preco_custo) || 0 : 0;
    if (!inputCustoNovo.value) {
      inputCustoNovo.value = paraInputMoeda(custoAtual);
    }
  };

  const atualizarPreview = () => {
    const p = produtoSelecionado();
    const qtd = Number(inputQuantidade.value) || 0;
    const estoqueAtual = p ? Number(p.estoque) || 0 : 0;
    const estoqueAntes =
      editando && p && p.id === movimento.produto_id ? estoqueAtual - movimento.quantidade : estoqueAtual;
    const custoAntigo = p ? Number(p.preco_custo) || 0 : 0;
    const custoNovo = valorDoInputMoeda(inputCustoNovo);
    const variacao = Math.round((custoNovo - custoAntigo) * 100) / 100;
    preview.innerHTML = `
      <div class="preview-item"><span>Estoque (antes)</span><strong>${estoqueAntes}</strong></div>
      <div class="preview-item"><span>Entrada</span><strong>+${qtd}</strong></div>
      <div class="preview-item"><span>Total Estoque</span><strong>${estoqueAntes + qtd}</strong></div>
      <div class="preview-item"><span>Custo antigo</span><strong>${formatarMoeda(custoAntigo)}</strong></div>
      <div class="preview-item"><span>Custo atual</span><strong>${formatarMoeda(custoNovo)}</strong></div>
      <div class="preview-item"><span>Variação</span><strong>${badgeVariacao(variacao)}</strong></div>
    `;
  };

  selectProduto.addEventListener('change', () => {
    inputCustoNovo.value = '';
    atualizarCustos();
    atualizarPreview();
  });
  inputQuantidade.addEventListener('input', () => {
    if (inputQuantidade.value && Number(inputQuantidade.value) > 999) {
      inputQuantidade.value = '999';
    }
    atualizarPreview();
  });
  aplicarMascaraMoeda(inputCustoNovo, 100);
  inputCustoNovo.addEventListener('input', atualizarPreview);
  atualizarCustos();
  atualizarPreview();

  const form = modal.querySelector('#form-movimento');
  const btnSalvar = form.querySelector('button[type="submit"]');
  let salvando = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (salvando) return;
    salvando = true;
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';
    const corpo = {
      produto_id: Number(form.produto_id.value),
      tipo: 'entrada',
      quantidade: Number(form.quantidade.value),
      custo_unitario: valorDoInputMoeda(form.custo_novo) || 0,
    };
    try {
      if (editando) {
        await requisicaoJSON(`${API()}/estoque/movimentos/${movimento.id}`, 'PUT', corpo, obterToken());
      } else {
        await requisicaoJSON(`${API()}/estoque/movimentos`, 'POST', corpo, obterToken());
      }
      fechar();
      await carregarTelaEstoque();
    } catch (erro) {
      alert(erro.message);
      salvando = false;
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar';
    }
  });
}

async function carregarMovimentos(produtoId) {
  try {
    const params = new URLSearchParams();
    if (produtoId) params.set('produto_id', produtoId);
    movimentosAtuais = await requisicaoJSON(`${API()}/estoque/movimentos?${params}`, 'GET', null, obterToken());
    renderMovimentos();
  } catch (erro) {
    tratarErro(erro);
  }
}

function renderMovimentos() {
  const corpo = document.getElementById('corpo-movimentos');
  if (!movimentosAtuais.length) {
    corpo.innerHTML = `<tr><td colspan="8" class="vazio">Nenhum movimento registrado.</td></tr>`;
    return;
  }

  corpo.innerHTML = movimentosAtuais
    .map((m) => {
      const entrada = m.tipo === 'entrada';
      const custoAntigo = m.custo_antigo;
      const custoAtual = m.custo_novo != null ? m.custo_novo : m.custo_unitario;
      return `
        <tr>
          <td><strong>${m.produto_nome}</strong></td>
          <td>${m.estoque_antes != null ? m.estoque_antes : '—'}</td>
          <td>${custoAntigo != null ? formatarMoeda(custoAntigo) : '—'}</td>
          <td><span class="badge ${entrada ? 'entrada' : 'saida'}">${entrada ? '+' : '-'}${m.quantidade}</span></td>
          <td>${custoAtual != null ? formatarMoeda(custoAtual) : '—'}</td>
          <td>${m.estoque_depois != null ? m.estoque_depois : '—'}</td>
          <td>${badgeVariacao(m.variacao_valor)}</td>
          <td class="acoes">
            <button class="btn icone" title="Editar movimento" onclick="abrirFormMovimento(${m.produto_id}, ${m.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
            </button>
            <button class="btn icone excluir" title="Excluir movimento" onclick="excluirMovimento(${m.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function excluirMovimento(id) {
  const movimento = movimentosAtuais.find((m) => m.id === id);
  if (!movimento) return;
  if (!confirm(`Excluir o movimento de "${movimento.produto_nome}"?`)) return;
  try {
    await requisicaoJSON(`${API()}/estoque/movimentos/${id}`, 'DELETE', null, obterToken());
    await carregarTelaEstoque();
  } catch (erro) {
    tratarErro(erro);
  }
}
