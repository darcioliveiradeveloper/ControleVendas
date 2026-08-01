registrarTela('vendas', carregarTelaVendas);

let produtosVenda = [];
let clientesVenda = [];
let carrinho = [];
let vendasAtuais = [];
let vendaDetalheAtual = null;

async function carregarTelaVendas() {
  const tela = document.getElementById('tela-vendas');
  tela.innerHTML = `
    <div class="venda-layout">
      <div class="venda-esquerda">
        <div class="panel">
          <h2>Nova venda / encomenda</h2>
          <div class="busca-relativa">
            <input id="busca-produto-venda" type="search" placeholder="Buscar produto para adicionar..." />
            <div id="resultado-busca" class="resultado-busca hidden"></div>
          </div>
          <div class="table-wrapper">
            <table class="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Preço</th>
                  <th>Qtd.</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="carrinho-corpo"></tbody>
            </table>
          </div>
          <div class="total-box">
            <span>Total</span>
            <strong id="carrinho-total">${formatarMoeda(0)}</strong>
          </div>
        </div>
      </div>

      <div class="venda-direita">
        <div class="panel">
          <h2>Finalizar</h2>
          <form id="form-finalizar" class="form" style="gap:14px">
            <div class="field">
              <label>Cliente</label>
              <select name="cliente_id">
                <option value="">Cliente avulso</option>
              </select>
            </div>
            <div class="field">
              <label>Tipo</label>
              <select name="tipo">
                <option value="venda">Venda (baixa estoque)</option>
                <option value="encomenda">Encomenda (sem baixa)</option>
              </select>
            </div>
            <div class="field">
              <label>Forma de pagamento</label>
              <select name="forma_pagamento">
                <option value="a_vista">À vista</option>
                <option value="parcelado">Parcelado</option>
              </select>
            </div>
            <div class="field hidden" id="campo-parcelas">
              <label>Número de parcelas</label>
              <input name="numero_parcelas" type="number" min="1" value="1" />
            </div>
            <div class="field">
              <label>Data da primeira parcela / vencimento</label>
              <input name="data_primeira_parcela" type="date" />
            </div>
            <div class="field">
              <label class="checkbox-label">
                <input name="pago" type="checkbox" /> Pagamento à vista recebido
              </label>
            </div>
            <button type="submit" class="btn primary">Confirmar venda</button>
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
              <th></th>
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
  const selectForma = formFinalizar.elements.forma_pagamento;
  const campoSeparacao = tela.querySelector('#campo-parcelas');
  selectForma.addEventListener('change', () => {
    campoSeparacao.classList.toggle('hidden', selectForma.value !== 'parcelado');
  });
  formFinalizar.addEventListener('submit', confirmarVenda);

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
              <div class="item-busca" onclick="adicionarAoCarrinho(${p.id})">
                <div>
                  <div class="nome">${p.nome}</div>
                  <div class="detalhe">Estoque: ${p.estoque}</div>
                </div>
                <span class="preco">${formatarMoeda(p.preco_venda)}</span>
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

function adicionarAoCarrinho(produtoId) {
  const produto = produtosVenda.find((p) => p.id === produtoId);
  if (!produto) return;

  const existente = carrinho.find((i) => i.id === produto.id);
  if (existente) {
    existente.quantidade += 1;
  } else {
    carrinho.push({ ...produto, quantidade: 1 });
  }

  document.getElementById('resultado-busca').classList.add('hidden');
  document.getElementById('busca-produto-venda').value = '';
  renderCarrinho();
}

function renderCarrinho() {
  const corpo = document.getElementById('carrinho-corpo');
  const total = carrinho.reduce((s, i) => s + i.preco_venda * i.quantidade, 0);

  if (!carrinho.length) {
    corpo.innerHTML = `<tr><td colspan="5" class="vazio">Carrinho vazio. Busque um produto acima.</td></tr>`;
  } else {
    corpo.innerHTML = carrinho
      .map(
        (i) => `
          <tr>
            <td>${i.nome}</td>
            <td>${formatarMoeda(i.preco_venda)}</td>
            <td>
              <input class="quantidade-input" type="number" min="1" value="${i.quantidade}"
                     onchange="alterarQuantidadeCarrinho(${i.id}, this.value)" />
            </td>
            <td>${formatarMoeda(i.preco_venda * i.quantidade)}</td>
            <td class="acoes">
              <button class="small-btn btn secondary" onclick="removerDoCarrinho(${i.id})">×</button>
            </td>
          </tr>
        `
      )
      .join('');
  }

  document.getElementById('carrinho-total').textContent = formatarMoeda(total);
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
  const corpo = {
    cliente_id: f.cliente_id.value ? Number(f.cliente_id.value) : null,
    tipo: f.tipo.value,
    forma_pagamento: f.forma_pagamento.value,
    pago: f.pago.checked,
    itens: carrinho.map((i) => ({ produto_id: i.id, quantidade: i.quantidade })),
  };
  if (f.forma_pagamento.value === 'parcelado') {
    corpo.numero_parcelas = Number(f.numero_parcelas.value) || 1;
  }
  if (f.data_primeira_parcela.value) {
    corpo.data_primeira_parcela = f.data_primeira_parcela.value;
  }

  try {
    await requisicaoJSON(`${API()}/vendas`, 'POST', corpo, obterToken());
    carrinho = [];
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
          <td>${v.forma_pagamento === 'parcelado' ? `Parcelado (${v.parcelas_pagas}/${v.total_parcelas})` : 'À vista'}</td>
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
        <div><div class="rotulo">Pagamento</div><div class="valor">${v.forma_pagamento === 'parcelado' ? 'Parcelado' : 'À vista'}</div></div>
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
              .map(
                (i) => `
                  <tr>
                    <td>${i.produto_nome}</td>
                    <td>${i.quantidade}</td>
                    <td>${formatarMoeda(i.preco_unitario)}</td>
                    <td>${formatarMoeda(i.preco_unitario * i.quantidade)}</td>
                  </tr>
                `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <h3>Parcelas</h3>
      <div class="table-wrapper">
        <table class="tabela">
          <thead>
            <tr><th>Nº</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr>
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
