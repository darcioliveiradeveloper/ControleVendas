registrarTela('despesas', carregarTelaDespesas);

let despesasAtuais = [];

async function carregarTelaDespesas() {
  const tela = document.getElementById('tela-despesas');
  tela.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <button class="btn primary" id="btn-nova-despesa">+ Nova Despesa</button>
        <input id="busca-despesas" type="search" placeholder="Buscar Despesa..." />
      </div>
      <div class="table-wrapper">
        <table class="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th class="acoes"></th>
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
              <button class="btn icone" title="Editar despesa" onclick="abrirFormDespesa(${d.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>
              </button>
              <button class="btn icone excluir" title="Excluir despesa" onclick="excluirDespesa(${d.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
              </button>
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

function despesaParaInput(valor) {
  const n = Number(valor);
  if (!isFinite(n) || n <= 0) return '';
  return n.toFixed(2).replace('.', ',');
}

function despesaValorDoInput(input) {
  const t = String(input.value || '').replace(/[^\d,]/g, '');
  if (!t) return null;
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

function despesaAplicarMascara(input) {
  input.addEventListener('input', () => {
    const digitos = String(input.value).replace(/\D/g, '').slice(0, 8);
    if (!digitos) {
      input.value = '';
      return;
    }
    const formatado = (Number(digitos) / 100).toFixed(2).replace('.', ',');
    if (input.value !== formatado) input.value = formatado;
  });
}

function abrirFormDespesa(id) {
  const despesa = id ? despesasAtuais.find((d) => d.id === id) : null;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-conteudo">
      <div class="modal-cabecalho">
        <h2>${despesa ? 'Editar Despesa' : 'Nova Despesa'}</h2>
        <button class="modal-fechar" type="button">×</button>
      </div>
      <form id="form-despesa">
        <div class="linha-despesa">
          <div class="field campo-descricao">
            <label>Descrição *</label>
            <input name="descricao" type="text" required value="${despesa ? (despesa.descricao || '') : ''}" />
          </div>
          <div class="field campo-categoria">
            <label>Categoria</label>
            <input name="categoria" type="text" placeholder="Ex.: Aluguel, Energia, Produtos" value="${despesa ? (despesa.categoria || '') : ''}" />
          </div>
          <div class="field campo-valor">
            <label>Valor *</label>
            <input name="valor" type="text" inputmode="decimal" maxlength="9" required placeholder="0,00" value="${despesa ? despesaParaInput(despesa.valor) : ''}" />
          </div>
          <div class="field campo-data">
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
  despesaAplicarMascara(modal.querySelector('input[name="valor"]'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) fechar();
  });

  modal.querySelector('#form-despesa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const corpo = {
      descricao: f.descricao.value,
      categoria: f.categoria.value || null,
      valor: despesaValorDoInput(f.valor),
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
