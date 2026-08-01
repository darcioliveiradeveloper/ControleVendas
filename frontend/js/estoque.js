registrarTela('estoque', carregarTelaEstoque);

let produtosEstoque = [];
let movimentosAtuais = [];

async function carregarTelaEstoque() {
  const tela = document.getElementById('tela-estoque');
  tela.innerHTML = `
    <div class="panel">
      <h2>Movimentar estoque</h2>
      <form id="form-movimento" class="form-grid">
        <div class="field">
          <label>Produto *</label>
          <select name="produto_id" required></select>
        </div>
        <div class="field">
          <label>Tipo *</label>
          <select name="tipo" required>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
        </div>
        <div class="field">
          <label>Quantidade *</label>
          <input name="quantidade" type="number" min="1" required />
        </div>
        <div class="field" id="campo-custo">
          <label>Custo unitário (R$)</label>
          <input name="custo_unitario" type="number" step="0.01" min="0" />
          <span class="help">Em entradas, atualiza o preço de custo e venda.</span>
        </div>
        <div class="field">
          <label>Observação</label>
          <input name="observacao" type="text" />
        </div>
        <div class="form-actions" style="grid-column:1/-1;margin-top:6px">
          <button type="submit" class="btn primary">Registrar movimento</button>
        </div>
      </form>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>Histórico</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select id="filtro-produto" style="width:auto;min-width:160px">
            <option value="">Todos os produtos</option>
          </select>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Produto</th>
              <th>Tipo</th>
              <th>Qtd.</th>
              <th>Custo unit.</th>
              <th>Obs.</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="corpo-movimentos"></tbody>
        </table>
      </div>
    </div>
  `;

  const selectProduto = tela.querySelector('select[name="produto_id"]');
  const campoCusto = tela.querySelector('#campo-custo');
  const selectTipo = tela.querySelector('select[name="tipo"]');

  const alternarCusto = () => {
    campoCusto.style.display = selectTipo.value === 'entrada' ? '' : 'none';
  };
  selectTipo.addEventListener('change', alternarCusto);

  tela.querySelector('#form-movimento').addEventListener('submit', registrarMovimento);
  tela.querySelector('#filtro-produto').addEventListener('change', (e) => carregarMovimentos(e.target.value));

  try {
    produtosEstoque = await requisicaoJSON(`${API()}/produtos`, 'GET', null, obterToken());
    const opcoes = produtosEstoque
      .map((p) => `<option value="${p.id}">${p.nome} (estoque: ${p.estoque})</option>`)
      .join('');
    selectProduto.innerHTML = opcoes;
    tela.querySelector('#filtro-produto').innerHTML =
      `<option value="">Todos os produtos</option>` + produtosEstoque
        .map((p) => `<option value="${p.id}">${p.nome}</option>`)
        .join('');
  } catch (erro) {
    tratarErro(erro);
  }

  await carregarMovimentos('');
}

async function registrarMovimento(e) {
  e.preventDefault();
  const form = e.target;
  const corpo = {
    produto_id: Number(form.produto_id.value),
    tipo: form.tipo.value,
    quantidade: Number(form.quantidade.value),
    observacao: form.observacao.value || null,
  };
  if (form.tipo.value === 'entrada') {
    corpo.custo_unitario = Number(form.custo_unitario.value) || 0;
  }

  try {
    const resultado = await requisicaoJSON(`${API()}/estoque/movimentos`, 'POST', corpo, obterToken());
    alert(`Movimento registrado. Estoque atual: ${resultado.estoque_atual}`);
    form.reset();
    await carregarTelaEstoque();
  } catch (erro) {
    alert(erro.message);
  }
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
    corpo.innerHTML = `<tr><td colspan="7" class="vazio">Nenhum movimento registrado.</td></tr>`;
    return;
  }

  corpo.innerHTML = movimentosAtuais
    .map((m) => {
      const entrada = m.tipo === 'entrada';
      return `
        <tr>
          <td class="data">${formatarData(m.criado_em)}</td>
          <td>${m.produto_nome}</td>
          <td><span class="badge ${entrada ? 'entrada' : 'saida'}">${entrada ? 'Entrada' : 'Saída'}</span></td>
          <td>${m.quantidade}</td>
          <td>${m.custo_unitario ? formatarMoeda(m.custo_unitario) : '—'}</td>
          <td>${m.observacao || '—'}</td>
          <td class="acoes">
            <button class="btn small secondary" onclick="estornarMovimento(${m.id})">Estornar</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function estornarMovimento(id) {
  if (!confirm('Estornar este movimento? O estoque será ajustado.')) return;
  try {
    const resultado = await requisicaoJSON(`${API()}/estoque/movimentos/${id}`, 'DELETE', null, obterToken());
    alert(`Movimento estornado. Estoque atual: ${resultado.estoque_atual}`);
    await carregarTelaEstoque();
  } catch (erro) {
    alert(erro.message);
  }
}
