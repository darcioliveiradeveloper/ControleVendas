registrarTela('despesas', carregarTelaDespesas);

let despesasAtuais = [];

async function carregarTelaDespesas() {
  const tela = document.getElementById('tela-despesas');
  tela.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>Despesas</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="busca-despesas" type="search" placeholder="Buscar despesa..." />
          <button class="btn primary" id="btn-nova-despesa">+ Nova despesa</button>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="corpo-despesas"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('busca-despesas').addEventListener('input', (e) => buscarDespesas(e.target.value));
  document.getElementById('btn-nova-despesa').addEventListener('click', abrirFormDespesa);

  await buscarDespesas('');
}

let timeoutBuscaDespesas = null;
async function buscarDespesas(texto) {
  clearTimeout(timeoutBuscaDespesas);
  timeoutBuscaDespesas = setTimeout(async () => {
    try {
      const busca = texto ? `?busca=${encodeURIComponent(texto)}` : '';
      despesasAtuais = await requisicaoJSON(`${API()}/despesas${busca}`, 'GET', null, obterToken());
      renderDespesas();
    } catch (erro) {
      tratarErro(erro);
    }
  }, 300);
}

function renderDespesas() {
  const corpo = document.getElementById('corpo-despesas');
  if (!despesasAtuais.length) {
    corpo.innerHTML = `<tr><td colspan="5" class="vazio">Nenhuma despesa cadastrada.</td></tr>`;
    return;
  }

  const total = despesasAtuais.reduce((s, d) => s + Number(d.valor), 0);

  corpo.innerHTML = `
    ${despesasAtuais
      .map(
        (d) => `
          <tr>
            <td class="data">${formatarData(d.data)}</td>
            <td>${d.descricao}</td>
            <td>${d.categoria || '—'}</td>
            <td>${formatarMoeda(d.valor)}</td>
            <td class="acoes">
              <button class="btn small secondary" onclick="abrirFormDespesa(${d.id})">Editar</button>
              <button class="btn small" style="background:#fee2e2;color:var(--erro)" onclick="excluirDespesa(${d.id})">Excluir</button>
            </td>
          </tr>
        `
      )
      .join('')}
    <tr class="linha-total">
      <td colspan="3"><strong>Total (${despesasAtuais.length} registro(s))</strong></td>
      <td colspan="2"><strong>${formatarMoeda(total)}</strong></td>
    </tr>
  `;
}

function abrirFormDespesa(id) {
  const despesa = id ? despesasAtuais.find((d) => d.id === id) : null;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-conteudo">
      <div class="modal-cabecalho">
        <h2>${despesa ? 'Editar despesa' : 'Nova despesa'}</h2>
        <button class="modal-fechar" type="button">×</button>
      </div>
      <form id="form-despesa">
        <div class="form-grid">
          <div class="field">
            <label>Descrição *</label>
            <input name="descricao" type="text" required value="${despesa ? (despesa.descricao || '') : ''}" />
          </div>
          <div class="field">
            <label>Categoria</label>
            <input name="categoria" type="text" placeholder="Ex.: aluguel, energia, produtos" value="${despesa ? (despesa.categoria || '') : ''}" />
          </div>
          <div class="field">
            <label>Valor *</label>
            <input name="valor" type="number" step="0.01" min="0.01" required value="${despesa ? despesa.valor : ''}" />
          </div>
          <div class="field">
            <label>Data</label>
            <input name="data" type="date" value="${despesa ? (despesa.data || '') : (new Date().toISOString().slice(0, 10))}" />
          </div>
        </div>
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

  modal.querySelector('#form-despesa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const corpo = {
      descricao: f.descricao.value,
      categoria: f.categoria.value || null,
      valor: Number(f.valor.value),
      data: f.data.value || undefined,
    };
    try {
      if (despesa) {
        await requisicaoJSON(`${API()}/despesas/${despesa.id}`, 'PUT', corpo, obterToken());
      } else {
        await requisicaoJSON(`${API()}/despesas`, 'POST', corpo, obterToken());
      }
      fechar();
      await buscarDespesas('');
    } catch (erro) {
      alert(erro.message);
    }
  });
}

async function excluirDespesa(id) {
  const despesa = despesasAtuais.find((d) => d.id === id);
  if (!despesa) return;
  if (!confirm(`Excluir a despesa "${despesa.descricao}"?`)) return;
  try {
    await requisicaoJSON(`${API()}/despesas/${id}`, 'DELETE', null, obterToken());
    await buscarDespesas('');
  } catch (erro) {
    tratarErro(erro);
  }
}
