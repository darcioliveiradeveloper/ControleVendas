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

// ---- Servidor ------------------------------------------------------------

const campoServidor = $('config-servidor');
const areaServidor = document.querySelector('.campo-servidor');
const apiSalva = localStorage.getItem('apiUrl');
if (apiSalva) {
  campoServidor.value = apiSalva;
} else {
  areaServidor.classList.add('hidden');
}

campoServidor.addEventListener('change', () => {
  definirApiUrl(campoServidor.value);
  if (!campoServidor.value) areaServidor.classList.add('hidden');
});

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
  definirApiUrl(campoServidor.value);

  const botao = evento.target.querySelector('button[type="submit"]');
  setCarregando(botao, true, 'Entrar');

  try {
    const dados = await requisicaoJSON(`${API()}/auth/login`, 'POST', {
      email: $('login-email').value,
      senha: $('login-senha').value,
    });
    localStorage.setItem('token', dados.token);
    localStorage.setItem('usuario', JSON.stringify(dados.usuario));
    window.location.href = 'app.html';
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
  definirApiUrl(campoServidor.value);

  const botao = evento.target.querySelector('button[type="submit"]');
  setCarregando(botao, true, 'Criar conta');

  try {
    const dados = await requisicaoJSON(`${API()}/auth/registrar`, 'POST', {
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

// ---- Inicializacao ----------------------------------------------------

(async function iniciar() {
  const token = obterToken();
  if (token) {
    window.location.href = 'app.html';
  }
})();
