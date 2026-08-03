registrarTela('clientes', carregarTelaClientes);

let clientesAtuais = [];

async function carregarTelaClientes() {
  const tela = document.getElementById('tela-clientes');
  tela.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>Clientes</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="busca-clientes" type="search" placeholder="Buscar cliente..." />
          <button class="btn primary" id="btn-novo-cliente">+ Novo cliente</button>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contato</th>
              <th>Email</th>
              <th>Nascimento</th>
              <th>Endereço</th>
              <th>Pontos</th>
              <th>Cadastrado em</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="corpo-clientes"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('busca-clientes').addEventListener('input', (e) => buscarClientes(e.target.value));
  document.getElementById('btn-novo-cliente').addEventListener('click', abrirFormCliente);

  await buscarClientes('');
}

let timeoutBuscaClientes = null;
async function buscarClientes(texto) {
  clearTimeout(timeoutBuscaClientes);
  timeoutBuscaClientes = setTimeout(async () => {
    try {
      const busca = texto ? `?busca=${encodeURIComponent(texto)}` : '';
      clientesAtuais = await requisicaoJSON(`${API()}/clientes${busca}`, 'GET', null, obterToken());
      renderClientes();
    } catch (erro) {
      tratarErro(erro);
    }
  }, 300);
}

function linkWhatsApp(numero) {
  const digitos = String(numero || '').replace(/\D/g, '');
  if (digitos.length < 10) return null;
  const internacional = digitos.length <= 11 ? '55' + digitos : digitos;
  return 'https://wa.me/' + internacional;
}

function renderClientes() {
  const corpo = document.getElementById('corpo-clientes');
  if (!clientesAtuais.length) {
    corpo.innerHTML = `<tr><td colspan="8" class="vazio">Nenhum cliente cadastrado.</td></tr>`;
    return;
  }

  corpo.innerHTML = clientesAtuais
    .map((c) => {
      const contato = c.whatsapp || c.telefone || '—';
      const ehWhats = !!c.whatsapp;
      const zap = c.whatsapp ? linkWhatsApp(c.whatsapp) : null;
      return `
        <tr>
          <td>${c.nome}</td>
          <td>
            ${contato}
            ${ehWhats && zap
              ? `<a class="badge zap-link" href="${zap}" target="_blank" rel="noopener" title="Chamar no WhatsApp">WhatsApp</a>`
              : ''}
          </td>
          <td>${c.email || '—'}</td>
          <td class="data">${formatarData(c.data_nascimento)}</td>
          <td>${c.endereco || '—'}</td>
          <td><span class="badge" style="background:var(--sucesso-suave);color:var(--sucesso)">${c.pontos || 0} pts</span></td>
          <td class="data">${formatarData(c.criado_em)}</td>
          <td class="acoes">
            <button class="btn small secondary" onclick="abrirFormCliente(${c.id})">Editar</button>
            <button class="btn small" style="background:#fee2e2;color:var(--erro)" onclick="excluirCliente(${c.id})">Excluir</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function abrirFormCliente(id) {
  const cliente = id ? clientesAtuais.find((c) => c.id === id) : null;
  const contatoInicial = cliente ? (cliente.whatsapp || cliente.telefone || '') : '';
  const tipoContatoInicial = cliente && cliente.whatsapp ? 'whatsapp' : cliente && cliente.telefone ? 'telefone' : 'whatsapp';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-conteudo">
      <div class="modal-cabecalho">
        <h2>${cliente ? 'Editar cliente' : 'Novo cliente'}</h2>
        <button class="modal-fechar" type="button">×</button>
      </div>
      <form id="form-cliente">
        <div class="form-grid">
          <div class="field">
            <label>Nome *</label>
            <input name="nome" type="text" required value="${cliente ? (cliente.nome || '') : ''}" />
          </div>
          <div class="field">
            <label id="label-contato">WhatsApp</label>
            <div class="contato-linha">
              <select name="tipo_contato">
                <option value="whatsapp" ${tipoContatoInicial === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
                <option value="telefone" ${tipoContatoInicial === 'telefone' ? 'selected' : ''}>Telefone</option>
              </select>
              <input name="contato" type="tel" placeholder="(11) 91234-5678" value="${contatoInicial}" />
            </div>
          </div>
          <div class="field">
            <label>Email</label>
            <input name="email" type="email" placeholder="cliente@email.com" value="${cliente ? (cliente.email || '') : ''}" />
          </div>
          <div class="field">
            <label>Data de nascimento</label>
            <input name="data_nascimento" type="date" value="${cliente ? (cliente.data_nascimento || '') : ''}" />
          </div>
          <div class="field">
            <label>Endereço</label>
            <input name="endereco" type="text" value="${cliente ? (cliente.endereco || '') : ''}" />
          </div>
        </div>
        ${cliente ? `<p class="help" style="margin-bottom:14px">Pontos atuais: <strong>${cliente.pontos || 0}</strong> (10 pontos = 50% de desconto em um produto)</p>` : ''}
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

  const selectTipo = modal.querySelector('select[name="tipo_contato"]');
  const inputContato = modal.querySelector('input[name="contato"]');
  const labelContato = modal.querySelector('#label-contato');
  const atualizarContato = () => {
    const ehTelefone = selectTipo.value === 'telefone';
    labelContato.textContent = ehTelefone ? 'Telefone' : 'WhatsApp';
    inputContato.placeholder = ehTelefone ? 'Ex.: (11) 3456-7890' : '(11) 91234-5678';
  };
  selectTipo.addEventListener('change', atualizarContato);
  atualizarContato();

  modal.querySelector('#form-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const tipoContato = f.tipo_contato.value;
    const contato = f.contato.value.trim();
    const corpo = {
      nome: f.nome.value,
      email: f.email.value || null,
      data_nascimento: f.data_nascimento.value || null,
      endereco: f.endereco.value || null,
    };
    if (tipoContato === 'telefone') {
      corpo.telefone = contato || null;
      corpo.whatsapp = null;
    } else {
      corpo.whatsapp = contato || null;
      corpo.telefone = null;
    }
    try {
      if (cliente) {
        await requisicaoJSON(`${API()}/clientes/${cliente.id}`, 'PUT', corpo, obterToken());
      } else {
        await requisicaoJSON(`${API()}/clientes`, 'POST', corpo, obterToken());
      }
      fechar();
      await buscarClientes('');
    } catch (erro) {
      alert(erro.message);
    }
  });
}

async function excluirCliente(id) {
  const cliente = clientesAtuais.find((c) => c.id === id);
  if (!cliente) return;
  if (!confirm(`Excluir o cliente "${cliente.nome}"?`)) return;
  try {
    await requisicaoJSON(`${API()}/clientes/${id}`, 'DELETE', null, obterToken());
    await buscarClientes('');
  } catch (erro) {
    tratarErro(erro);
  }
}
