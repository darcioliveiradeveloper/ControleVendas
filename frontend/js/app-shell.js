const telas = {};
let telaAtual = 'vendas';

const TITULOS = {
  resumo: 'Resumo',
  produtos: 'Produtos',
  estoque: 'Estoque',
  vendas: 'Vendas',
  despesas: 'Despesas',
  clientes: 'Clientes',
  relatorios: 'Relatórios',
};

function registrarTela(nome, fn) {
  telas[nome] = fn;
}

function mostrarTela(nome) {
  if (!telas[nome]) return;
  telaAtual = nome;
  document.querySelectorAll('.tela').forEach((s) => s.classList.add('hidden'));
  document.getElementById('tela-' + nome).classList.remove('hidden');
  document.getElementById('titulo-tela').textContent = TITULOS[nome] || nome;
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tela === nome));
  fecharMenu();
  telas[nome]();
}

function fecharMenu() {
  document.getElementById('sidebar').classList.remove('aberta');
  document.getElementById('overlay').classList.add('hidden');
}

function formatarData(valor) {
  if (!valor) return '—';
  const data = new Date(String(valor).replace(' ', 'T'));
  if (isNaN(data.getTime())) return valor;
  return data.toLocaleDateString('pt-BR');
}

function tratarErro(erro) {
  if (/token/i.test(erro.message) || /login/i.test(erro.message)) {
    sair();
    return;
  }
  alert(erro.message);
}

function iniciarApp() {
  const token = obterToken();
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const usuario = obterUsuario();
  document.getElementById('usuario-nome').textContent = usuario && usuario.nome ? usuario.nome : 'Usuário';

  document.getElementById('btn-sair').addEventListener('click', sair);
  document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('aberta');
    document.getElementById('overlay').classList.remove('hidden');
  });
  document.getElementById('overlay').addEventListener('click', fecharMenu);

  document.querySelectorAll('.nav-item').forEach((botao) => {
    botao.addEventListener('click', () => mostrarTela(botao.dataset.tela));
  });

  mostrarTela('vendas');
}

document.addEventListener('DOMContentLoaded', iniciarApp);
