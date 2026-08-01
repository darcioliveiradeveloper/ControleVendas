const $ = (id) => document.getElementById(id);

let editandoId = null;
let fotoNovaArquivo = null;
let fotoAtual = null;
let removerFotoNaEdicao = false;

// ---- Navegação ---------------------------------------------------------

const titulos = { dashboard: 'Dashboard', produtos: 'Produtos', estoque: 'Estoque' };

document.querySelectorAll('.nav-item[data-tela]').forEach((botao) => {
  botao.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    botao.classList.add('active');
    abrirTela(botao.dataset.tela);
    fecharMenu();
  });
});

function abrirTela(nome) {
  document.querySelectorAll('.tela').forEach((t) => t.classList.add('hidden'));
  const tela = document.getElementById('tela-' + nome);
  if (tela) tela.classList.remove('hidden');
  $('titulo-tela').textContent = titulos[nome] || nome;
}

// ---- Menu mobile -------------------------------------------------------

const btnMenu = $('btn-menu');
const sidebar = $('sidebar');
const overlay = $('overlay');

function abrirMenu() {
  sidebar.classList.add('aberta');
  overlay.classList.remove('hidden');
}

function fecharMenu() {
  sidebar.classList.remove('aberta');
  overlay.classList.add('hidden');
}

btnMenu.addEventListener('click', abrirMenu);
overlay.addEventListener('click', fecharMenu);

// ---- Sair --------------------------------------------------------------

$('btn-sair').addEventListener('click', () => {
  if (confirm('Deseja sair do sistema?')) sair();
});

// ---- Autenticação ------------------------------------------------------

if (!obterToken()) {
  window.location.href = '/';
} else {
  const usuario = obterUsuario();
  $('nome-usuario').textContent = usuario ? usuario.nome : 'Usuário';
}

// ---- Foto ---------------------------------------------------------------

const previewFoto = $('preview-foto');

function mostrarPreview(fonte) {
  if (!fonte) {
    previewFoto.innerHTML = '<span>Sem foto</span>';
    return;
  }
  previewFoto.innerHTML = '<img src="' + fonte + '" alt="Foto do produto" />';
}

$('p-foto').addEventListener('change', (evento) => {
  const arquivo = evento.target.files[0];
  if (arquivo) {
    fotoNovaArquivo = arquivo;
    removerFotoNaEdicao = false;
    mostrarPreview(URL.createObjectURL(arquivo));
  }
});

// ---- Preço automático ---------------------------------------------------

function calcularPrecoVenda() {
  const custo = parseFloat($('p-custo').value) || 0;
  const margem = parseFloat($('p-margem').value) || 0;
  const venda = custo * (1 + margem / 100);
  $('p-venda').value = venda
    ? venda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';
}

$('p-custo').addEventListener('input', calcularPrecoVenda);
$('p-margem').addEventListener('input', calcularPrecoVenda);

// ---- Formulário ----------------------------------------------------------

function mostrarMensagem(texto, tipo) {
  const el = $('msg-produto');
  el.textContent = texto;
  el.className = 'mensagem ' + tipo;
  el.classList.remove('hidden');
  if (tipo === 'sucesso') {
    setTimeout(() => el.classList.add('hidden'), 3500);
  }
}

function limparFormulario() {
  $('form-produto').reset();
  $('p-venda').value = '';
  editandoId = null;
  fotoNovaArquivo = null;
  fotoAtual = null;
  removerFotoNaEdicao = false;
  mostrarPreview(null);
  $('btn-salvar').textContent = 'Salvar produto';
  $('btn-cancelar').classList.add('hidden');
}

$('btn-cancelar').addEventListener('click', limparFormulario);

$('form-produto').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const botao = $('btn-salvar');
  botao.disabled = true;

  try {
    const formData = new FormData();
    formData.append('nome', $('p-nome').value);
    formData.append('descricao', $('p-descricao').value);
    formData.append('preco_custo', $('p-custo').value || '0');
    formData.append('margem_percentual', $('p-margem').value || '0');
    formData.append('estoque', $('p-estoque').value || '0');

    if (fotoNovaArquivo) {
      formData.append('foto', fotoNovaArquivo);
    } else if (editandoId && removerFotoNaEdicao) {
      formData.append('manter_foto', 'false');
    }

    let resposta;
    if (editandoId) {
      resposta = await requisicaoForm(`${API}/produtos/${editandoId}`, 'PUT', formData, obterToken());
      mostrarMensagem('Produto atualizado com sucesso!', 'sucesso');
    } else {
      resposta = await requisicaoForm(`${API}/produtos`, 'POST', formData, obterToken());
      mostrarMensagem('Produto cadastrado com sucesso!', 'sucesso');
    }

    limparFormulario();
    await carregarProdutos();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  } finally {
    botao.disabled = false;
  }
});

// ---- Lista ---------------------------------------------------------------

async function carregarProdutos() {
  const lista = $('lista-produtos');
  lista.innerHTML = '<div class="vazio">Carregando produtos...</div>';

  try {
    const busca = $('busca-produtos').value.trim();
    const url = busca ? `${API}/produtos?busca=${encodeURIComponent(busca)}` : `${API}/produtos`;
    const produtos = await requisicaoJSON(url, 'GET', null, obterToken());

    if (!produtos.length) {
      lista.innerHTML = '<div class="vazio">Nenhum produto cadastrado ainda.</div>';
      return;
    }

    lista.innerHTML = '';
    produtos.forEach((produto) => lista.appendChild(criarCard(produto)));
  } catch (erro) {
    lista.innerHTML = '<div class="vazio">' + escapar(erro.message) + '</div>';
  }
}

function criarCard(produto) {
  const card = document.createElement('div');
  card.className = 'produto-card';

  const fotoHtml = produto.foto
    ? '<img src="' + produto.foto + '" alt="' + escapar(produto.nome) + '" />'
    : '<span>Sem foto</span>';

  const estoqueBaixo = produto.estoque <= 5;
  const estoqueHtml =
    '<span class="' + (estoqueBaixo ? 'estoque-baixo' : '') + '">Estoque: ' + produto.estoque + '</span>';

  card.innerHTML =
    '<div class="produto-foto">' + fotoHtml + '</div>' +
    '<div class="produto-info">' +
    '<span class="produto-nome">' + escapar(produto.nome) + '</span>' +
    '<span class="produto-desc">' + escapar(produto.descricao || '') + '</span>' +
    '<span class="produto-preco">' + formatarMoeda(produto.preco_venda) + '</span>' +
    estoqueHtml +
    '</div>' +
    '<div class="produto-acoes">' +
    '<button class="btn editar">Editar</button>' +
    '<button class="btn excluir">Excluir</button>' +
    '</div>';

  card.querySelector('.btn.editar').addEventListener('click', () => editarProduto(produto));
  card.querySelector('.btn.excluir').addEventListener('click', () => excluirProduto(produto));
  return card;
}

function editarProduto(produto) {
  editandoId = produto.id;
  fotoAtual = produto.foto;
  removerFotoNaEdicao = false;

  $('p-nome').value = produto.nome;
  $('p-descricao').value = produto.descricao || '';
  $('p-custo').value = produto.preco_custo;
  $('p-margem').value = produto.margem_percentual;
  $('p-estoque').value = produto.estoque;
  $('p-venda').value = formatarMoeda(produto.preco_venda).replace('R$ ', '');
  mostrarPreview(produto.foto || null);
  $('btn-salvar').textContent = 'Atualizar produto';
  $('btn-cancelar').classList.remove('hidden');

  abrirTela('produtos');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirProduto(produto) {
  if (!confirm('Excluir o produto "' + produto.nome + '"? Esta ação não pode ser desfeita.')) return;

  try {
    await requisicaoJSON(`${API}/produtos/${produto.id}`, 'DELETE', null, obterToken());
    await carregarProdutos();
  } catch (erro) {
    alert(erro.message);
  }
}

$('busca-produtos').addEventListener('input', () => carregarProdutos());

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// ---- Início ----------------------------------------------------------------

carregarProdutos();
