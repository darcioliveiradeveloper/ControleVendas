const $ = (id) => document.getElementById(id);

let editandoId = null;

function mostrarMensagem(texto, tipo) {
  const el = $('msg-cliente');
  el.textContent = texto;
  el.className = 'mensagem ' + tipo;
  el.classList.remove('hidden');
  if (tipo === 'sucesso') {
    setTimeout(() => el.classList.add('hidden'), 3500);
  }
}

function limparFormulario() {
  $('form-cliente').reset();
  editandoId = null;
  $('btn-salvar-cliente').textContent = 'Salvar cliente';
  $('btn-cancelar-cliente').classList.add('hidden');
}

$('btn-cancelar-cliente').addEventListener('click', limparFormulario);

$('form-cliente').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const botao = $('btn-salvar-cliente');
  botao.disabled = true;

  try {
    const corpo = {
      nome: $('c-nome').value,
      telefone: $('c-telefone').value,
      endereco: $('c-endereco').value,
    };

    if (editandoId) {
      await requisicaoJSON(`${API}/clientes/${editandoId}`, 'PUT', corpo, obterToken());
      mostrarMensagem('Cliente atualizado com sucesso!', 'sucesso');
    } else {
      await requisicaoJSON(`${API}/clientes`, 'POST', corpo, obterToken());
      mostrarMensagem('Cliente cadastrado com sucesso!', 'sucesso');
    }

    limparFormulario();
    await carregarClientes();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  } finally {
    botao.disabled = false;
  }
});

async function carregarClientes() {
  const corpo = $('corpo-clientes');
  corpo.innerHTML = '<tr><td colspan="4" class="vazio">Carregando clientes...</td></tr>';

  try {
    const busca = $('busca-clientes').value.trim();
    const url = busca ? `${API}/clientes?busca=${encodeURIComponent(busca)}` : `${API}/clientes`;
    const clientes = await requisicaoJSON(url, 'GET', null, obterToken());

    if (!clientes.length) {
      corpo.innerHTML = '<tr><td colspan="4" class="vazio">Nenhum cliente cadastrado.</td></tr>';
      return;
    }

    corpo.innerHTML = '';
    clientes.forEach((cliente) => corpo.appendChild(criarLinha(cliente)));
  } catch (erro) {
    corpo.innerHTML = `<tr><td colspan="4" class="vazio">${escapar(erro.message)}</td></tr>`;
  }
}

function criarLinha(cliente) {
  const tr = document.createElement('tr');
  tr.innerHTML =
    `<td><strong>${escapar(cliente.nome)}</strong></td>` +
    `<td>${escapar(cliente.telefone || '—')}</td>` +
    `<td>${escapar(cliente.endereco || '—')}</td>` +
    `<td class="acoes">` +
    `<button class="btn editar small-btn">Editar</button> ` +
    `<button class="btn excluir small-btn">Excluir</button>` +
    `</td>`;

  tr.querySelectorAll('button')[0].addEventListener('click', () => editarCliente(cliente));
  tr.querySelectorAll('button')[1].addEventListener('click', () => excluirCliente(cliente));
  return tr;
}

function editarCliente(cliente) {
  editandoId = cliente.id;
  $('c-nome').value = cliente.nome;
  $('c-telefone').value = cliente.telefone || '';
  $('c-endereco').value = cliente.endereco || '';
  $('btn-salvar-cliente').textContent = 'Atualizar cliente';
  $('btn-cancelar-cliente').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirCliente(cliente) {
  if (!confirm(`Excluir o cliente "${cliente.nome}"?`)) return;

  try {
    await requisicaoJSON(`${API}/clientes/${cliente.id}`, 'DELETE', null, obterToken());
    await carregarClientes();
  } catch (erro) {
    alert(erro.message);
  }
}

$('busca-clientes').addEventListener('input', () => carregarClientes());

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

carregarClientes();
