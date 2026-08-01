const API_PADRAO = 'http://localhost:3000';

function obterApiUrl() {
  return localStorage.getItem('apiUrl') || API_PADRAO;
}

function definirApiUrl(url) {
  if (url) {
    localStorage.setItem('apiUrl', url.trim().replace(/\/+$/, ''));
  }
}

const API = () => obterApiUrl() + '/api';

function urlFoto(caminho) {
  return caminho ? obterApiUrl() + caminho : null;
}

async function requisicaoJSON(url, metodo, corpo, token) {
  const opcoes = {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
  };
  if (corpo) opcoes.body = JSON.stringify(corpo);
  if (token) opcoes.headers['Authorization'] = 'Bearer ' + token;

  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique o endereço configurado.');
  }
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
  opcoes.body = formData;
  if (token) opcoes.headers['Authorization'] = 'Bearer ' + token;

  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique o endereço configurado.');
  }
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
  window.location.href = 'index.html';
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
