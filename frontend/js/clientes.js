registrarTela('clientes', carregarTelaClientes);

let clientesAtuais = [];

async function carregarTelaClientes() {
  const tela = document.getElementById('tela-clientes');
  tela.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <button class="btn primary" id="btn-novo-cliente">+ Novo Cliente</button>
        <input id="busca-clientes" type="search" placeholder="Buscar Cliente..." />
      </div>
      <div class="table-wrapper">
        <table class="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contato</th>
              <th>Email</th>
              <th>Nascimento</th>
              <th>Pontos</th>
              <th class="col-cadastro">Cliente desde</th>
              <th class="acoes">Ações</th>
            </tr>
          </thead>
          <tbody id="corpo-clientes"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('busca-clientes').addEventListener('input', (e) => buscarClientes(e.target.value));
  tela.querySelector('#btn-novo-cliente').addEventListener('click', abrirFormCliente);

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

function mascaraTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (digitos.length > 6) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length > 2) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  }
  if (digitos.length > 0) {
    return `(${digitos}`;
  }
  return '';
}

function aplicarMascaraTelefone(input) {
  input.addEventListener('input', () => {
    const pos = input.selectionStart || 0;
    const antes = input.value;
    const masc = mascaraTelefone(input.value);
    if (masc === antes) return;
    const digitosAteCursor = antes.slice(0, pos).replace(/\D/g, '').length;
    input.value = masc;
    let novo = 0;
    let digitos = 0;
    while (novo < masc.length && digitos < digitosAteCursor) {
      if (/\d/.test(masc[novo])) digitos++;
      novo++;
    }
    input.setSelectionRange(novo, novo);
  });
}

function proximoAniversario(dataNascimento) {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento + 'T00:00:00');
  const hoje = new Date();
  const hojeInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let proximo = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
  if (proximo < hojeInicio) {
    proximo = new Date(hoje.getFullYear() + 1, nasc.getMonth(), nasc.getDate());
  }
  return proximo;
}

function diasAteAniversario(dataNascimento) {
  const proximo = proximoAniversario(dataNascimento);
  if (!proximo) return null;
  const hojeInicio = new Date();
  hojeInicio.setHours(0, 0, 0, 0);
  return Math.round((proximo - hojeInicio) / 86400000);
}

function badgeAniversario(dataNascimento) {
  const dias = diasAteAniversario(dataNascimento);
  if (dias === null) return '';
  if (dias === 0) return `<span class="aniversario-badge hoje">Aniversariante hoje</span>`;
  if (dias <= 30) return `<span class="aniversario-badge em-breve">Em ${dias} ${dias === 1 ? 'dia' : 'dias'}</span>`;
  const proximo = proximoAniversario(dataNascimento);
  const hoje = new Date();
  const meses = (proximo.getFullYear() - hoje.getFullYear()) * 12 + (proximo.getMonth() - hoje.getMonth());
  return `<span class="aniversario-badge distante">Em ${meses} ${meses === 1 ? 'mês' : 'meses'}</span>`;
}

function renderClientes() {
  const corpo = document.getElementById('corpo-clientes');
  if (!clientesAtuais.length) {
    corpo.innerHTML = `<tr><td colspan="8" class="vazio">Nenhum cliente cadastrado.</td></tr>`;
    return;
  }

  const ordenados = [...clientesAtuais].sort((a, b) => {
    const da = diasAteAniversario(a.data_nascimento);
    const db = diasAteAniversario(b.data_nascimento);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });

  corpo.innerHTML = ordenados
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
              ? `<a class="zap-link" href="${zap}" target="_blank" rel="noopener" title="Chamar no WhatsApp" aria-label="Chamar no WhatsApp">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>`
              : ''}
          </td>
          <td>${c.email || '—'}</td>
          <td class="data">${formatarData(c.data_nascimento)}${badgeAniversario(c.data_nascimento)}</td>
          <td><span class="badge" style="background:var(--sucesso-suave);color:var(--sucesso)">${c.pontos || 0} pts</span></td>
          <td class="data col-cadastro">${formatarData(c.criado_em)}</td>
          <td class="acoes">
            <button class="btn icone" title="Editar cliente" onclick="abrirFormCliente(${c.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
            </button>
            <button class="btn icone excluir" title="Excluir cliente" onclick="excluirCliente(${c.id})">
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

function abrirFormCliente(id, aoSalvar) {
  const cliente = id ? clientesAtuais.find((c) => c.id === id) : null;
  const contatoInicial = cliente ? (cliente.whatsapp || cliente.telefone || '') : '';
  const tipoContatoInicial = cliente && cliente.whatsapp ? 'whatsapp' : cliente && cliente.telefone ? 'telefone' : 'whatsapp';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-conteudo">
      <div class="modal-cabecalho">
        <h2>${cliente ? 'Editar Cliente' : 'Novo Cliente'}</h2>
        <button class="modal-fechar" type="button">×</button>
      </div>
      <form id="form-cliente">
        <div class="form-grid">
          <div class="field">
            <label>Nome *</label>
            <input name="nome" type="text" required value="${cliente ? (cliente.nome || '') : ''}" />
          </div>
          <div class="field">
            <label>Data de nascimento</label>
            <input name="data_nascimento" type="date" value="${cliente ? (cliente.data_nascimento || '') : ''}" />
          </div>
          <div class="field">
            <label>Cliente desde</label>
            <input name="cliente_desde" type="text" readonly value="${cliente ? formatarData(cliente.criado_em) : formatarData(new Date())}" />
          </div>
          <div class="field">
            <label>Email</label>
            <input name="email" type="email" placeholder="cliente@email.com" value="${cliente ? (cliente.email || '') : ''}" />
          </div>
          <div class="field">
            <label>Contato</label>
            <select name="tipo_contato">
              <option value="whatsapp" ${tipoContatoInicial === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
              <option value="telefone" ${tipoContatoInicial === 'telefone' ? 'selected' : ''}>Telefone</option>
            </select>
          </div>
          <div class="field">
            <label id="label-contato">WhatsApp</label>
            <input name="contato" type="tel" placeholder="(11) 91234-5678" value="${contatoInicial}" />
          </div>
        </div>
        ${cliente ? `<p class="help" style="margin-bottom:14px">Pontos atuais: <strong>${cliente.pontos || 0}</strong></p>` : ''}
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
  inputContato.value = mascaraTelefone(inputContato.value);
  aplicarMascaraTelefone(inputContato);

  const formCliente = modal.querySelector('#form-cliente');
  const btnSalvar = formCliente.querySelector('button[type="submit"]');
  let salvando = false;
  formCliente.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (salvando) return;
    salvando = true;
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';
    const f = e.target;
    const nasc = f.data_nascimento.value;
    if (nasc) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nasc);
      if (!m) {
        alert('Data de nascimento deve estar no formato dd/mm/aaaa.');
        salvando = false;
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar';
        return;
      }
      const nascData = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (
        nascData.getFullYear() !== Number(m[1]) ||
        nascData.getMonth() !== Number(m[2]) - 1 ||
        nascData.getDate() !== Number(m[3]) ||
        Number(m[1]) < 1900
      ) {
        alert('Data de nascimento inválida.');
        salvando = false;
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar';
        return;
      }
      const hoje = new Date();
      const hojeInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      if (nascData > hojeInicio) {
        alert('A data de nascimento não pode estar no futuro.');
        salvando = false;
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar';
        return;
      }
    }
    const tipoContato = f.tipo_contato.value;
    const contato = f.contato.value.trim();
    const corpo = {
      nome: f.nome.value,
      email: f.email.value || null,
      data_nascimento: f.data_nascimento.value || null,
    };
    if (tipoContato === 'telefone') {
      corpo.telefone = contato || null;
      corpo.whatsapp = null;
    } else {
      corpo.whatsapp = contato || null;
      corpo.telefone = null;
    }
    try {
      let salvo;
      if (cliente) {
        salvo = await requisicaoJSON(`${API()}/clientes/${cliente.id}`, 'PUT', corpo, obterToken());
      } else {
        salvo = await requisicaoJSON(`${API()}/clientes`, 'POST', corpo, obterToken());
      }
      fechar();
      await buscarClientes('');
      if (typeof aoSalvar === 'function') aoSalvar(salvo);
    } catch (erro) {
      alert(erro.message);
      salvando = false;
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar';
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
