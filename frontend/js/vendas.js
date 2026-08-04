registrarTela('vendas', carregarTelaVendas);

let produtosVenda = [];
let clientesVenda = [];
let escolhidos = [];
let carrinho = [];
let vendasAtuais = [];
let vendaDetalheAtual = null;

const NOME_PAGAMENTO = {
  a_vista: 'À vista',
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  parcelado: 'Parcelado',
};

async function carregarTelaVendas() {
  const tela = document.getElementById('tela-vendas');
  tela.innerHTML = `
    <div class="venda-layout">
      <div class="venda-esquerda">
        <div class="panel">
          <h2>Venda / Encomenda</h2>
          <div class="busca-relativa">
            <input id="busca-produto-venda" class="busca-produto-grande" type="search" placeholder="Buscar produto..." />
            <div id="resultado-busca" class="resultado-busca hidden"></div>
          </div>

          <div id="selecao-bloco" class="selecao-bloco hidden">
            <h3>Escolhido — defina a quantidade e adicione ao carrinho</h3>
            <div class="table-wrapper">
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Preço</th>
                    <th>Qtd.</th>
                    <th>Subtotal</th>
                    <th class="acoes"></th>
                  </tr>
                </thead>
                <tbody id="selecao-corpo"></tbody>
              </table>
            </div>
          </div>

          <div class="table-wrapper">
            <table class="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Preço</th>
                  <th>Qtd.</th>
                  <th>Subtotal</th>
                  <th class="acoes"></th>
                </tr>
              </thead>
              <tbody id="carrinho-corpo"></tbody>
            </table>
          </div>
          <p class="help" id="resumo-pontos"></p>
          <div class="total-box">
            <span>Total em dinheiro</span>
            <strong id="carrinho-total">${formatarMoeda(0)}</strong>
          </div>
          <div class="total-box total-itens">
            <span>Total de itens</span>
            <strong id="carrinho-itens">0</strong>
          </div>
        </div>
      </div>

      <div class="venda-direita">
        <div class="panel">
          <h2>Concluir venda</h2>
          <form id="form-finalizar" class="form" style="gap:14px">
            <div class="field">
              <label>Cliente</label>
              <div class="cliente-novo-linha">
                <select name="cliente_id">
                  <option value="">Cliente avulso</option>
                </select>
                <button type="button" class="btn small secondary" id="btn-novo-cliente">+ Novo</button>
              </div>
            </div>
            <p class="help" id="info-pontos-cliente" style="margin-top:-4px">Cliente avulso — sem pontos.</p>
            <div class="field">
              <label>Tipo</label>
              <select name="tipo">
                <option value="venda">Venda (baixa estoque)</option>
                <option value="encomenda">Encomenda (sem baixa)</option>
              </select>
            </div>
            <div class="field">
              <label>Forma de pagamento</label>
              <div class="pagamento-grid">
                <button type="button" class="pagamento-btn" data-forma="pix">Pix</button>
                <button type="button" class="pagamento-btn" data-forma="dinheiro">Dinheiro</button>
                <button type="button" class="pagamento-btn" data-forma="parcelado">Parcelado</button>
              </div>
              <input type="hidden" name="forma_pagamento" value="pix" />
            </div>
            <div id="campo-parcelas" class="parcela-campos hidden">
              <div class="field">
                <label>Quantidade de parcelas</label>
                <input name="numero_parcelas" type="number" min="1" value="1" />
              </div>
              <ul id="preview-parcelas" class="preview-parcelas"></ul>
              <label class="checkbox-label">
                <input name="primeira_parcela_avista" type="checkbox" /> Primeira parcela à vista (entrada)
              </label>
            </div>
            <button type="submit" class="btn primary">Concluir venda</button>
          </form>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>Vendas</h2>
        <div class="filtros" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="busca-venda" type="search" placeholder="Buscar por cliente..." />
          <select id="filtro-tipo-venda">
            <option value="">Todas</option>
            <option value="venda">Vendas</option>
            <option value="encomenda">Encomendas</option>
          </select>
          <select id="filtro-status-venda">
            <option value="">Todos os status</option>
            <option value="ativa">Ativa</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="tabela">
          <thead>
            <tr>
              <th>#</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Pagamento</th>
              <th>Total</th>
              <th>Status</th>
              <th class="acoes"></th>
            </tr>
          </thead>
          <tbody id="corpo-vendas"></tbody>
        </table>
      </div>
    </div>
  `;

  const busca = tela.querySelector('#busca-produto-venda');
  const resultado = tela.querySelector('#resultado-busca');
  busca.addEventListener('input', () => buscarProdutosVenda(busca.value, resultado));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.busca-relativa')) resultado.classList.add('hidden');
  });

  const formFinalizar = tela.querySelector('#form-finalizar');
  const campoForma = formFinalizar.elements.forma_pagamento;
  const campoSeparacao = tela.querySelector('#campo-parcelas');
  const botoesPagamento = tela.querySelectorAll('.pagamento-btn');

  const selecionarForma = (forma) => {
    campoForma.value = forma;
    botoesPagamento.forEach((b) => {
      const ativo = b.dataset.forma === forma;
      b.classList.toggle('active', ativo);
      b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    });
    campoSeparacao.classList.toggle('hidden', forma !== 'parcelado');
    if (forma === 'parcelado') atualizarPreviewParcelas();
  };
  botoesPagamento.forEach((b) => b.addEventListener('click', () => selecionarForma(b.dataset.forma)));
  formFinalizar.elements.numero_parcelas.addEventListener('change', atualizarPreviewParcelas);
  selecionarForma('pix');
  formFinalizar.addEventListener('submit', confirmarVenda);

  const selectCliente = formFinalizar.querySelector('select[name="cliente_id"]');
  const infoPontos = tela.querySelector('#info-pontos-cliente');
  const selecionarCliente = (id) => {
    const c = clientesVenda.find((x) => x.id === Number(id));
    infoPontos.textContent = c ? `Pontos disponíveis: ${c.pontos || 0}` : 'Cliente avulso — sem pontos.';
    renderCarrinho();
  };
  selectCliente.addEventListener('change', () => selecionarCliente(selectCliente.value));

  tela.querySelector('#btn-novo-cliente').addEventListener('click', () => {
    abrirFormCliente(undefined, (novo) => {
      clientesVenda.push(novo);
      selectCliente.insertAdjacentHTML('beforeend', `<option value="${novo.id}">${novo.nome}</option>`);
      selectCliente.value = String(novo.id);
      selecionarCliente(novo.id);
    });
  });

  tela.querySelector('#busca-venda').addEventListener('input', (e) => {
    const t = e.target.value;
    setTimeout(() => carregarVendas(t), 300);
  });
  tela.querySelector('#filtro-tipo-venda').addEventListener('change', () => carregarVendas());
  tela.querySelector('#filtro-status-venda').addEventListener('change', () => carregarVendas());

  try {
    const [produtos, clientes] = await Promise.all([
      requisicaoJSON(`${API()}/produtos`, 'GET', null, obterToken()),
      requisicaoJSON(`${API()}/clientes`, 'GET', null, obterToken()),
    ]);
    produtosVenda = produtos;
    clientesVenda = clientes;
    formFinalizar.querySelector('select[name="cliente_id"]').innerHTML =
      `<option value="">Cliente avulso</option>` +
      clientes.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('');
  } catch (erro) {
    tratarErro(erro);
  }

  carrinho = [];
  escolhidos = [];
  renderCarrinho();
  await carregarVendas();
}

let timeoutBuscaProduto = null;
async function buscarProdutosVenda(texto, divResultado) {
  clearTimeout(timeoutBuscaProduto);
  timeoutBuscaProduto = setTimeout(async () => {
    if (!texto.trim()) {
      divResultado.classList.add('hidden');
      return;
    }
    try {
      const lista = await requisicaoJSON(
        `${API()}/produtos?busca=${encodeURIComponent(texto)}`,
        'GET',
        null,
        obterToken()
      );
      if (!lista.length) {
        divResultado.innerHTML = `<div class="item-busca sem-resultado">Nenhum produto encontrado.</div>`;
      } else {
        divResultado.innerHTML = lista
          .map(
            (p) => `
              <div class="item-busca" onclick="escolherProduto(${p.id})">
                <div>
                  <div class="nome">${p.nome}</div>
                  <div class="detalhe">Estoque: ${p.estoque}</div>
                </div>
                <span class="preco">${formatarMoeda(p.preco_venda)}</span>
                <button type="button" class="btn small primary" onclick="event.stopPropagation(); escolherProduto(${p.id})">Escolher</button>
              </div>
            `
          )
          .join('');
      }
      divResultado.classList.remove('hidden');
    } catch (erro) {
      tratarErro(erro);
    }
  }, 250);
}

function escolherProduto(produtoId) {
  const produto = produtosVenda.find((p) => p.id === produtoId);
  if (!produto) return;
  if (!escolhidos.some((i) => i.id === produto.id)) {
    escolhidos.push({ ...produto, quantidade: 1 });
  }
  document.getElementById('resultado-busca').classList.add('hidden');
  document.getElementById('busca-produto-venda').value = '';
  renderSelecao();
}

function renderSelecao() {
  const corpo = document.getElementById('selecao-corpo');
  const bloco = document.getElementById('selecao-bloco');
  if (!escolhidos.length) {
    bloco.classList.add('hidden');
    corpo.innerHTML = '';
    return;
  }
  bloco.classList.remove('hidden');
  corpo.innerHTML = escolhidos
    .map((i) => {
      const sub = i.preco_venda * i.quantidade;
      return `
        <tr>
          <td>${i.nome}</td>
          <td>${formatarMoeda(i.preco_venda)}</td>
          <td>
            <input class="quantidade-input" type="number" min="1" value="${i.quantidade}"
                   onchange="alterarQtdEscolhido(${i.id}, this.value)" />
          </td>
          <td>${formatarMoeda(sub)}</td>
          <td class="acoes">
            <button class="btn small primary" onclick="adicionarAoCarrinho(${i.id})">Adicionar</button>
            <button class="btn small secondary" onclick="removerEscolhido(${i.id})">×</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function alterarQtdEscolhido(id, qtd) {
  const item = escolhidos.find((i) => i.id === id);
  if (!item) return;
  item.quantidade = Math.max(1, parseInt(qtd, 10) || 1);
  renderSelecao();
}

function removerEscolhido(id) {
  escolhidos = escolhidos.filter((i) => i.id !== id);
  renderSelecao();
}

function adicionarAoCarrinho(escolhidoId) {
  const escolhido = escolhidos.find((i) => i.id === escolhidoId);
  if (!escolhido) return;
  const existente = carrinho.find((i) => i.id === escolhido.id);
  if (existente) {
    existente.quantidade += escolhido.quantidade;
  } else {
    carrinho.push({ ...escolhido, quantidade: escolhido.quantidade });
  }
  escolhidos = escolhidos.filter((i) => i.id !== escolhidoId);
  renderSelecao();
  renderCarrinho();
}

function atualizarPreviewParcelas() {
  const n = Math.max(1, parseInt(document.querySelector('#form-finalizar [name="numero_parcelas"]').value, 10) || 1);
  const total = carrinho.reduce((s, i) => s + i.preco_venda * (1 - (i.desconto_percentual === 50 ? 0.5 : 0)) * i.quantidade, 0);
  const base = Math.floor((total * 100) / n) / 100;
  const hoje = new Date();
  let soma = 0;
  const linhas = [];
  for (let i = 1; i <= n; i++) {
    const valor = i === n ? Math.round((total - soma) * 100) / 100 : base;
    soma += valor;
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + (i - 1), hoje.getDate());
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    linhas.push(`<li>Parcela ${i} — ${dd}/${mm}/${yyyy} — <strong>${formatarMoeda(valor)}</strong></li>`);
  }
  const el = document.getElementById('preview-parcelas');
  if (el) el.innerHTML = linhas.join('');
}

function renderCarrinho() {
  const corpo = document.getElementById('carrinho-corpo');
  const lineTotal = (i) =>
    i.preco_venda * (1 - (i.desconto_percentual === 50 ? 0.5 : 0)) * i.quantidade;
  const total = carrinho.reduce((s, i) => s + lineTotal(i), 0);
  const itensComDesconto = carrinho.filter((i) => i.desconto_percentual === 50);
  const pontosUsados = itensComDesconto.length * 10;
  const descontoTotal = itensComDesconto.reduce((s, i) => s + i.preco_venda * 0.5 * i.quantidade, 0);

  if (!carrinho.length) {
    corpo.innerHTML = `<tr><td colspan="5" class="vazio">Carrinho vazio — busque um produto e clique em <strong>Escolher</strong>.</td></tr>`;
  } else {
    corpo.innerHTML = carrinho
      .map((i) => {
        const comDesconto = i.desconto_percentual === 50;
        return `
          <tr>
            <td>${i.nome}${comDesconto ? ' <span class="badge" style="background:var(--sucesso-suave);color:var(--sucesso)">50% off</span>' : ''}</td>
            <td>${formatarMoeda(i.preco_venda)}</td>
            <td>
              <input class="quantidade-input" type="number" min="1" value="${i.quantidade}"
                     onchange="alterarQuantidadeCarrinho(${i.id}, this.value)" />
            </td>
            <td>${formatarMoeda(lineTotal(i))}</td>
            <td class="acoes">
              ${
                comDesconto
                  ? `<button class="small-btn btn" style="background:var(--sucesso-suave);color:var(--sucesso)" onclick="removerDescontoCarrinho(${i.id})">10 pts ✓</button>`
                  : `<button class="small-btn btn" style="background:var(--pendencia-suave);color:var(--pendencia)" onclick="aplicarDescontoCarrinho(${i.id})">🎁 Usar 10 pts</button>`
              }
              <button class="small-btn btn secondary" onclick="removerDoCarrinho(${i.id})">×</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  document.getElementById('carrinho-total').textContent = formatarMoeda(total);
  const totalItens = carrinho.reduce((s, i) => s + i.quantidade, 0);
  const elItens = document.getElementById('carrinho-itens');
  if (elItens) elItens.textContent = totalItens;
  const resumo = document.getElementById('resumo-pontos');
  if (resumo) {
    resumo.textContent = pontosUsados
      ? `Desconto por pontos: ${formatarMoeda(descontoTotal)} (${pontosUsados} pontos)`
      : '';
  }
  const campoParcelas = document.getElementById('campo-parcelas');
  if (campoParcelas && !campoParcelas.classList.contains('hidden')) atualizarPreviewParcelas();
}

function aplicarDescontoCarrinho(produtoId) {
  const selectCliente = document.querySelector('#form-finalizar select[name="cliente_id"]');
  const cliente = clientesVenda.find((c) => c.id === Number(selectCliente.value));
  if (!cliente) {
    alert('Selecione um cliente para usar pontos.');
    return;
  }
  const item = carrinho.find((i) => i.id === produtoId);
  if (!item) return;
  const usados = carrinho.filter((i) => i.desconto_percentual === 50).length * 10;
  if ((cliente.pontos || 0) < usados + 10) {
    alert(`O cliente tem ${cliente.pontos || 0} ponto(s). São necessários ${usados + 10}.`);
    return;
  }
  item.desconto_percentual = 50;
  renderCarrinho();
}

function removerDescontoCarrinho(produtoId) {
  const item = carrinho.find((i) => i.id === produtoId);
  if (!item) return;
  item.desconto_percentual = 0;
  renderCarrinho();
}

function alterarQuantidadeCarrinho(produtoId, quantidade) {
  const item = carrinho.find((i) => i.id === produtoId);
  if (!item) return;
  item.quantidade = Math.max(1, parseInt(quantidade, 10) || 1);
  renderCarrinho();
}

function removerDoCarrinho(produtoId) {
  carrinho = carrinho.filter((i) => i.id !== produtoId);
  renderCarrinho();
}

async function confirmarVenda(e) {
  e.preventDefault();
  if (!carrinho.length) {
    alert('Adicione pelo menos um produto.');
    return;
  }
  const f = e.target;
  const forma = f.forma_pagamento.value;
  const corpo = {
    cliente_id: f.cliente_id.value ? Number(f.cliente_id.value) : null,
    tipo: f.tipo.value,
    forma_pagamento: forma,
    pago: forma !== 'parcelado',
    itens: carrinho.map((i) => ({
      produto_id: i.id,
      quantidade: i.quantidade,
      desconto_percentual: i.desconto_percentual === 50 ? 50 : 0,
    })),
  };
  if (forma === 'parcelado') {
    corpo.numero_parcelas = Number(f.numero_parcelas.value) || 1;
    corpo.primeira_parcela_avista = f.primeira_parcela_avista.checked;
  }

  try {
    await requisicaoJSON(`${API()}/vendas`, 'POST', corpo, obterToken());
    carrinho = [];
    escolhidos = [];
    f.reset();
    await carregarTelaVendas();
  } catch (erro) {
    alert(erro.message);
  }
}

let timeoutBuscaVenda = null;
async function carregarVendas(busca) {
  clearTimeout(timeoutBuscaVenda);
  timeoutBuscaVenda = setTimeout(async () => {
    const tipo = document.getElementById('filtro-tipo-venda').value;
    const status = document.getElementById('filtro-status-venda').value;
    const params = new URLSearchParams();
    if (tipo) params.set('tipo', tipo);
    if (status) params.set('status', status);
    if (busca) params.set('busca', busca);
    try {
      vendasAtuais = await requisicaoJSON(`${API()}/vendas?${params}`, 'GET', null, obterToken());
      renderVendas();
    } catch (erro) {
      tratarErro(erro);
    }
  }, 250);
}

function renderVendas() {
  const corpo = document.getElementById('corpo-vendas');
  if (!vendasAtuais.length) {
    corpo.innerHTML = `<tr><td colspan="8" class="vazio">Nenhuma venda encontrada.</td></tr>`;
    return;
  }

  corpo.innerHTML = vendasAtuais
    .map((v) => {
      const statusBadge =
        v.status === 'cancelada'
          ? '<span class="badge" style="background:#fee2e2;color:var(--erro)">Cancelada</span>'
          : v.tipo === 'encomenda'
            ? '<span class="badge pendencia">Encomenda</span>'
            : v.parcelas_pagas === v.total_parcelas
              ? '<span class="badge entrada">Quitada</span>'
              : '<span class="badge pendencia">Pendente</span>';

      return `
        <tr>
          <td>#${v.id}</td>
          <td class="data">${formatarData(v.criado_em)}</td>
          <td>${v.cliente_nome || 'Avulso'}</td>
          <td>${v.tipo === 'encomenda' ? 'Encomenda' : 'Venda'}</td>
          <td>${v.forma_pagamento === 'parcelado' ? `Parcelado (${v.parcelas_pagas}/${v.total_parcelas})` : (NOME_PAGAMENTO[v.forma_pagamento] || 'À vista')}</td>
          <td><strong>${formatarMoeda(v.total)}</strong></td>
          <td>${statusBadge}</td>
          <td class="acoes">
            <button class="btn small secondary" onclick="abrirDetalheVenda(${v.id})">Detalhes</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function abrirDetalheVenda(id) {
  try {
    vendaDetalheAtual = await requisicaoJSON(`${API()}/vendas/${id}`, 'GET', null, obterToken());
    renderDetalheVenda();
  } catch (erro) {
    tratarErro(erro);
  }
}

function renderDetalheVenda() {
  const v = vendaDetalheAtual;
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-conteudo">
      <div class="modal-cabecalho">
        <h2>Venda #${v.id}</h2>
        <button class="modal-fechar" type="button">×</button>
      </div>

      <div class="detalhe-cabecalho">
        <div><div class="rotulo">Data</div><div class="valor">${formatarData(v.criado_em)}</div></div>
        <div><div class="rotulo">Cliente</div><div class="valor">${v.cliente_nome || 'Avulso'}</div></div>
        <div><div class="rotulo">Tipo</div><div class="valor">${v.tipo === 'encomenda' ? 'Encomenda' : 'Venda'}</div></div>
        <div><div class="rotulo">Pagamento</div><div class="valor">${NOME_PAGAMENTO[v.forma_pagamento] || 'À vista'}</div></div>
        <div><div class="rotulo">Status</div><div class="valor">${v.status === 'cancelada' ? 'Cancelada' : v.quitada ? 'Quitada' : 'Ativa'}</div></div>
      </div>

      <h3>Itens</h3>
      <div class="table-wrapper">
        <table class="tabela">
          <thead>
            <tr><th>Produto</th><th>Qtd.</th><th>Preço</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
            ${v.itens
              .map((i) => {
                const comDesconto = i.desconto_percentual === 50;
                const original = comDesconto ? Math.round(i.preco_unitario * 2 * 100) / 100 : null;
                return `
                  <tr>
                    <td>${i.produto_nome}</td>
                    <td>${i.quantidade}</td>
                    <td>
                      ${
                        comDesconto
                          ? `<span style="text-decoration:line-through;color:var(--texto-suave)">${formatarMoeda(original)}</span> ${formatarMoeda(i.preco_unitario)} <span class="badge" style="background:var(--sucesso-suave);color:var(--sucesso)">50% pts</span>`
                          : formatarMoeda(i.preco_unitario)
                      }
                    </td>
                    <td>${formatarMoeda(i.preco_unitario * i.quantidade)}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>

      <h3>Parcelas</h3>
      <div class="table-wrapper">
        <table class="tabela">
          <thead>
            <tr><th>Nº</th><th>Vencimento</th><th>Valor</th><th>Status</th><th class="acoes"></th></tr>
          </thead>
          <tbody>
            ${v.parcelas
              .map(
                (p) => `
                  <tr>
                    <td>${p.numero}</td>
                    <td class="data">${formatarData(p.data_vencimento)}</td>
                    <td>${formatarMoeda(p.valor)}</td>
                    <td class="${p.pago ? 'parcela-paga' : 'parcela-pendente'}">${p.pago ? 'Paga' : 'Pendente'}</td>
                    <td class="acoes">
                      ${
                        v.status === 'cancelada'
                          ? ''
                          : p.pago
                            ? `<button class="btn pago" onclick="alternarParcela(${p.id}, false)">Paga ✓</button>`
                            : `<button class="btn pagar" onclick="alternarParcela(${p.id}, true)">Marcar paga</button>`
                      }
                    </td>
                  </tr>
                `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      ${
        v.pontos_ganhos || v.pontos_utilizados
          ? `<p class="help">Pontos: <strong>+${v.pontos_ganhos || 0}</strong> ganhos / <strong>${v.pontos_utilizados || 0}</strong> usados</p>`
          : ''
      }

      <div class="total-box" style="margin-top:12px">
        <span>Total</span>
        <strong>${formatarMoeda(v.total)}</strong>
      </div>

      ${
        v.status === 'cancelada'
          ? ''
          : `<div class="modal-acoes">
              ${v.tipo === 'encomenda' ? `<button class="btn primary" onclick="confirmarEncomenda(${v.id})">Confirmar encomenda (baixa estoque)</button>` : ''}
              <button class="btn secondary" style="background:#fee2e2;color:var(--erro)" onclick="cancelarVenda(${v.id})">Cancelar venda</button>
            </div>`
      }
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('.modal-fechar').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  window.alternarParcela = async (parcelaId, pago) => {
    try {
      await requisicaoJSON(`${API()}/vendas/${v.id}/parcelas/${parcelaId}`, 'PUT', { pago }, obterToken());
      await abrirDetalheVenda(v.id);
      await carregarVendas();
    } catch (erro) {
      alert(erro.message);
    }
  };

  window.confirmarEncomenda = async (vendaId) => {
    if (!confirm('Confirmar esta encomenda? O estoque será baixado.')) return;
    try {
      await requisicaoJSON(`${API()}/vendas/${vendaId}/confirmar`, 'POST', {}, obterToken());
      await abrirDetalheVenda(vendaId);
      await carregarVendas();
    } catch (erro) {
      alert(erro.message);
    }
  };

  window.cancelarVenda = async (vendaId) => {
    if (!confirm('Cancelar esta venda? O estoque de vendas será devolvido.')) return;
    try {
      await requisicaoJSON(`${API()}/vendas/${vendaId}`, 'DELETE', null, obterToken());
      await abrirDetalheVenda(vendaId);
      await carregarVendas();
    } catch (erro) {
      alert(erro.message);
    }
  };
}
