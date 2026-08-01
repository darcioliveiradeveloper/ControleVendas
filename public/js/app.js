const API = '/api';

const $ = (id) => document.getElementById(id);
const mensagem = $('mensagem');

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = 'mensagem ' + tipo;
  mensagem.classList.remove('hidden');
}

function esconderMensagem() {
  mensagem.classList.add('hidden');
}

function setCarregando(botao, carregando, textoNormal) {
  botao.disabled = carregando;
  botao.textContent = carregando ? 'Aguarde...' : textoNormal;
}

async function requisicaoJSON(url, metodo, corpo, token) {
  const opcoes = {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
  };
  if (corpo) opcoes.body = JSON.stringify(corpo);
  if (token) opcoes.headers['Authorization'] = 'Bearer ' + token;

  const resposta = await fetch(url, opcoes);
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Erro na requisição.');
  }
  return dados;
}

// ---- Abas -------------------------------------------------------------

$('tab-login').addEventListener('click', () => mudarAba('login'));
$('tab-cadastro').addEventListener('click', () => mudarAba('cadastro'));

function mudarAba(aba) {
  esconderMensagem();
  $('tab-login').classList.toggle('active', aba === 'login');
  $('tab-cadastro').classList.toggle('active', aba === 'cadastro');
  $('form-login').classList.toggle('hidden', aba !== 'login');
  $('form-cadastro').classList.toggle('hidden', aba !== 'cadastro');
}

// ---- Login ------------------------------------------------------------

$('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  esconderMensagem();

  const botao = evento.target.querySelector('button[type="submit"]');
  setCarregando(botao, true, 'Entrar');

  try {
    const dados = await requisicaoJSON(`${API}/auth/login`, 'POST', {
      email: $('login-email').value,
      senha: $('login-senha').value,
    });
    salvarSessao(dados.token, dados.usuario);
    await entrarNoSistema();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  } finally {
    setCarregando(botao, false, 'Entrar');
  }
});

// ---- Cadastro ---------------------------------------------------------

$('form-cadastro').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  esconderMensagem();

  const botao = evento.target.querySelector('button[type="submit"]');
  setCarregando(botao, true, 'Criar conta');

  try {
    const dados = await requisicaoJSON(`${API}/auth/registrar`, 'POST', {
      nome: $('cad-nome').value,
      email: $('cad-email').value,
      senha: $('cad-senha').value,
    });
    mostrarMensagem('Conta criada com sucesso! Faça login para continuar.', 'sucesso');
    mudarAba('login');
    $('login-email').value = dados.usuario.email;
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  } finally {
    setCarregando(botao, false, 'Criar conta');
  }
});

// ---- Sessao -----------------------------------------------------------

function salvarSessao(token, usuario) {
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

function obterSessao() {
  const token = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
  return { token, usuario };
}

function sair() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.reload();
}

async function entrarNoSistema() {
  const { token } = obterSessao();
  try {
    const dados = await requisicaoJSON(`${API}/me`, 'GET', null, token);
    const nome = dados.usuario.nome || dados.usuario.email;
    mensagem.className = 'mensagem sucesso';
    mensagem.innerHTML =
      'Login validado com sucesso!<br><strong>' +
      escapar(nome) +
      '</strong>, o sistema está funcionando.<br><br><button class="btn primary" onclick="sair()">Sair</button>';
    mensagem.classList.remove('hidden');
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
    sair();
  }
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// ---- Inicializacao ----------------------------------------------------

(async function iniciar() {
  const { token } = obterSessao();
  if (token) {
    mudarAba('login');
    await entrarNoSistema();
  }
})();
