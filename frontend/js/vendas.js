registrarTela('vendas', carregarTelaVendas);

let produtosVenda = [];
let clientesVenda = [];
let escolhidos = [];
let carrinho = [];

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
              <table class="tabela tabela-movel">
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
            <table class="tabela tabela-movel">
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
          <form id="form-finalizar" class="form" style="gap:23px">
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

    <div id="confirmacao-venda" class="hidden" style="margin-top:16px"></div>
  `;

  const busca = tela.querySelector('#busca-produto-venda');
  const resultado = tela.querySelector('#resultado-busca');
  busca.addEventListener('input', () => buscarProdutosVenda(busca.value, resultado));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.busca-relativa')) resultado.classList.add('hidden');
  });

  const formFinalizar = tela.querySelector('#form-finalizar');
  const botoesPagamento = tela.querySelectorAll('.pagamento-btn');

  botoesPagamento.forEach((b) => b.addEventListener('click', () => selecionarForma(b.dataset.forma)));
  formFinalizar.elements.numero_parcelas.addEventListener('change', atualizarPreviewParcelas);
  selecionarForma('pix');
  formFinalizar.addEventListener('submit', confirmarVenda);

  const selectCliente = formFinalizar.querySelector('select[name="cliente_id"]');
  selectCliente.addEventListener('change', () => selecionarCliente(selectCliente.value));

  tela.querySelector('#btn-novo-cliente').addEventListener('click', () => {
    abrirFormCliente(undefined, (novo) => {
      clientesVenda.push(novo);
      selectCliente.insertAdjacentHTML('beforeend', `<option value="${novo.id}">${novo.nome}</option>`);
      selectCliente.value = String(novo.id);
      selecionarCliente(novo.id);
    });
  });

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
          <td data-label="Produto">${i.nome}</td>
          <td data-label="Preço">${formatarMoeda(i.preco_venda)}</td>
          <td data-label="Qtd.">
            <input class="quantidade-input" type="number" min="1" value="${i.quantidade}"
                   onchange="alterarQtdEscolhido(${i.id}, this.value)" />
          </td>
          <td data-label="Subtotal">${formatarMoeda(sub)}</td>
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
            <td data-label="Produto">${i.nome}${comDesconto ? ' <span class="badge" style="background:var(--sucesso-suave);color:var(--sucesso)">50% off</span>' : ''}</td>
            <td data-label="Preço">${formatarMoeda(i.preco_venda)}</td>
            <td data-label="Qtd.">
              <input class="quantidade-input" type="number" min="1" value="${i.quantidade}"
                     onchange="alterarQuantidadeCarrinho(${i.id}, this.value)" />
            </td>
            <td data-label="Subtotal">${formatarMoeda(lineTotal(i))}</td>
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

function selecionarCliente(id) {
  const infoPontos = document.getElementById('info-pontos-cliente');
  if (!infoPontos) return;
  const c = clientesVenda.find((x) => x.id === Number(id));
  infoPontos.textContent = c ? `Pontos disponíveis: ${c.pontos || 0}` : 'Cliente avulso — sem pontos.';
  renderCarrinho();
}

function selecionarForma(forma) {
  const campoForma = document.querySelector('#form-finalizar [name="forma_pagamento"]');
  const botoesPagamento = document.querySelectorAll('#form-finalizar .pagamento-btn');
  const campoSeparacao = document.getElementById('campo-parcelas');
  if (!campoForma || !campoSeparacao) return;
  campoForma.value = forma;
  botoesPagamento.forEach((b) => {
    const ativo = b.dataset.forma === forma;
    b.classList.toggle('active', ativo);
    b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
  });
  campoSeparacao.classList.toggle('hidden', forma !== 'parcelado');
  if (forma === 'parcelado') atualizarPreviewParcelas();
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
    const venda = await requisicaoJSON(`${API()}/vendas`, 'POST', corpo, obterToken());
    carrinho = [];
    escolhidos = [];
    f.reset();
    selecionarForma('pix');
    renderSelecao();
    renderCarrinho();
    mostrarConfirmacao(venda);
    try {
      const [produtos, clientes] = await Promise.all([
        requisicaoJSON(`${API()}/produtos`, 'GET', null, obterToken()),
        requisicaoJSON(`${API()}/clientes`, 'GET', null, obterToken()),
      ]);
      produtosVenda = produtos;
      clientesVenda = clientes;
      const selectCliente = document.querySelector('#form-finalizar select[name="cliente_id"]');
      if (selectCliente) selecionarCliente(selectCliente.value);
    } catch (erro) {
      tratarErro(erro);
    }
  } catch (erro) {
    alert(erro.message);
  }
}

function mostrarConfirmacao(venda) {
  const painel = document.getElementById('confirmacao-venda');
  const pagamento =
    venda.forma_pagamento === 'parcelado'
      ? `Parcelado (${venda.parcelas.length}x)`
      : NOME_PAGAMENTO[venda.forma_pagamento] || 'À vista';
  const itensHtml = venda.itens
    .map(
      (i) => `
        <tr>
          <td>${i.produto_nome}</td>
          <td>${i.quantidade}</td>
          <td>${formatarMoeda(i.preco_unitario)}</td>
          <td>${formatarMoeda(i.preco_unitario * i.quantidade)}</td>
        </tr>`
    )
    .join('');

  painel.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>Venda #${venda.id} <span class="badge entrada">Venda concluída ✓</span></h2>
      </div>
      <div class="detalhe-cabecalho">
        <div><div class="rotulo">Data</div><div class="valor">${formatarData(venda.criado_em)}</div></div>
        <div><div class="rotulo">Cliente</div><div class="valor">${venda.cliente_nome || 'Avulso'}</div></div>
        <div><div class="rotulo">Pagamento</div><div class="valor">${pagamento}</div></div>
      </div>
      <div class="table-wrapper">
        <table class="tabela">
          <thead><tr><th>Produto</th><th>Qtd.</th><th>Preço</th><th>Subtotal</th></tr></thead>
          <tbody>${itensHtml}</tbody>
        </table>
      </div>
      <div class="total-box" style="margin-top:12px">
        <span>Total</span>
        <strong>${formatarMoeda(venda.total)}</strong>
      </div>
      <div class="confirmacao-acoes">
        <button type="button" class="btn primary" id="btn-salvar-confirmacao">Salvar</button>
      </div>
    </div>
  `;

  painel.classList.remove('hidden');
  painel.querySelector('#btn-salvar-confirmacao').addEventListener('click', () => {
    painel.classList.add('hidden');
    painel.innerHTML = '';
  });
}
