const API = '/api';

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

async function requisicaoForm(url, metodo, formData, token) {
  const opcoes = {
    method: metodo,
    headers: {},
  };
  if (token) opcoes.headers['Authorization'] = 'Bearer ' + token;

  const resposta = await fetch(url, opcoes);
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Erro na requisição.');
  }
  return dados;
}

function obterToken() {
  return localStorage.getItem('token');
}

function obterUsuario() {
  return JSON.parse(localStorage.getItem('usuario') || 'null');
}

function sair() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = '/';
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
