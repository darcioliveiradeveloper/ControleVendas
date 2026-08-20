registrarTela('resumo', carregarTelaResumo);

async function carregarTelaResumo() {
  const tela = document.getElementById('tela-resumo');
  tela.innerHTML = `<div class="vazio">Carregando resumo...</div>`;

  try {
    const hoje = new Date();
    const primeiroDia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
    const ultimoDia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${new Date(
      hoje.getFullYear(),
      hoje.getMonth() + 1,
      0
    ).getDate()}`;

    const periodoSql = `?inicio=${primeiroDia}&fim=${ultimoDia}`;
    const [dados, doMes, produtos] = await Promise.all([
      requisicaoJSON(`${API()}/relatorios/resumo`, 'GET', null, obterToken()),
      requisicaoJSON(`${API()}/relatorios/resumo${periodoSql}`, 'GET', null, obterToken()),
      requisicaoJSON(`${API()}/produtos`, 'GET', null, obterToken()),
    ]);

    const lucroLiquido = Number(doMes.lucro_liquido) || 0;

    const renderTopProdutos = (lista, vazio) =>
      lista.length
        ? `<div class="table-wrapper">
             <table class="tabela">
               <thead><tr><th>Produto</th><th>Qtd.</th><th>Total</th></tr></thead>
               <tbody>
                 ${lista
                   .map(
                     (p) => `<tr><td>${p.nome}</td><td>${p.quantidade}</td><td>${formatarMoeda(p.total)}</td></tr>`
                   )
                   .join('')}
               </tbody>
             </table>
           </div>`
        : `<div class="vazio">${vazio}</div>`;

    const renderTopClientes = (lista, vazio) =>
      lista.length
        ? `<div class="table-wrapper">
             <table class="tabela">
               <thead><tr><th>Cliente</th><th>Vendas</th><th>Total</th></tr></thead>
               <tbody>
                 ${lista
                   .map(
                     (c) => `<tr><td>${c.nome}</td><td>${c.vendas}</td><td>${formatarMoeda(c.total)}</td></tr>`
                   )
                   .join('')}
               </tbody>
             </table>
           </div>`
        : `<div class="vazio">${vazio}</div>`;

    const card = (rotulo, valor, classe = '', compacto = false) => `
      <div class="card ${compacto ? 'card-qtde' : ''}">
        <span class="card-rotulo">${rotulo}</span>
        <span class="card-valor ${classe}">${valor}</span>
      </div>
    `;

    const secao = (titulo, cardsHtml, classe = '', id = '') => `
      <div class="resumo-secao ${classe}" ${id ? `id="${id}"` : ''}>
        <h3 class="section-titulo">${titulo}</h3>
        <div class="cards-grid">${cardsHtml}</div>
      </div>
    `;

    const lucroPresumido = (produtos || []).reduce((s, p) => {
      const qtd = Number(p.estoque) || 0;
      if (qtd <= 0) return s;
      return s + Math.round(((Number(p.preco_venda) || 0) - (Number(p.preco_custo) || 0)) * qtd * 100) / 100;
    }, 0);

    const lucroLiquidoGeral = Number(dados.lucro_liquido) || 0;

    tela.innerHTML = `
      <div class="resumo-indicadores">
        <h3 class="section-titulo resumo-titulo-secao">Mês Atual</h3>
        <div class="cards-grid resumo-cards">
          ${[
            card('Vendas', doMes.vendas.quantidade, '', true),
            card('Faturamento', formatarMoeda(doMes.vendas.receita)),
            card('Lucro', formatarMoeda(doMes.vendas.lucro), 'lucro'),
            card('Despesas', formatarMoeda(doMes.despesas.total), 'gasto'),
            card('Lucro Líquido', formatarMoeda(lucroLiquido), lucroLiquido >= 0 ? 'lucro' : 'gasto'),
          ].join('')}
        </div>
        <h3 class="section-titulo resumo-titulo-secao">Desde o Início</h3>
        <div class="cards-grid resumo-cards">
          ${[
            card('Vendas', dados.vendas.quantidade, '', true),
            card('Faturamento', formatarMoeda(dados.vendas.receita)),
            card('Lucro', formatarMoeda(dados.vendas.lucro), 'lucro'),
            card('Despesas', formatarMoeda(dados.despesas.total), 'gasto'),
            card('Lucro Líquido', formatarMoeda(lucroLiquidoGeral), lucroLiquidoGeral >= 0 ? 'lucro' : 'gasto'),
          ].join('')}
        </div>
        <h3 class="section-titulo resumo-titulo-secao">Estado Atual</h3>
        <div class="cards-grid resumo-cards" id="estado-atual">
          ${[
            card('Encomendas abertas', dados.encomendas_abertas),
            card('A receber (parcelas)', formatarMoeda(dados.parcelas_abertas.valor)),
            card('Parcelas vencidas', dados.parcelas_vencidas.quantidade),
            card('Clientes', dados.clientes),
            card('Produtos', dados.produtos),
            card('Lucro presumido (estoque)', formatarMoeda(lucroPresumido), 'lucro'),
          ].join('')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head" style="justify-content:flex-start">
          <h2>Vendas (consulta)</h2>
          <input id="busca-venda" type="search" placeholder="Buscar por Cliente..." />
          <select id="filtro-tipo-venda" style="width:auto">
            <option value="">Todas</option>
            <option value="venda">Vendas</option>
            <option value="encomenda">Encomendas</option>
          </select>
          <select id="filtro-status-venda" style="width:auto">
            <option value="">Todos os status</option>
            <option value="ativa">Ativa</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <select id="filtro-pagamento-venda" style="width:auto">
            <option value="">Todas</option>
            <option value="quitada">Quitadas</option>
            <option value="pendente">Pendentes</option>
          </select>
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
      <div class="resumo-top">
        <div class="panel">
          <h2>Produtos Mais Vendidos (Desde o Início)</h2>
          ${renderTopProdutos(dados.top_produtos || [], 'Sem vendas ainda.')}
        </div>
        <div class="panel">
          <h2>Produtos Mais Vendidos (Mês)</h2>
          ${renderTopProdutos(doMes.top_produtos || [], 'Sem vendas no mês ainda.')}
        </div>
        <div class="panel">
          <h2>Top Clientes (Desde o Início)</h2>
          ${renderTopClientes(dados.top_clientes || [], 'Sem clientes ainda.')}
        </div>
        <div class="panel">
          <h2>Top Clientes (Mês)</h2>
          ${renderTopClientes(doMes.top_clientes || [], 'Sem clientes no mês ainda.')}
        </div>
      </div>
      <div class="vazio">Use o menu lateral para acessar as telas.</div>
    `;

    tela.querySelector('#busca-venda').addEventListener('input', (e) => {
      const t = e.target.value;
      setTimeout(() => carregarVendas(t), 300);
    });
    tela.querySelector('#filtro-tipo-venda').addEventListener('change', () => carregarVendas());
    tela.querySelector('#filtro-status-venda').addEventListener('change', () => carregarVendas());
    tela.querySelector('#filtro-pagamento-venda').addEventListener('change', () => carregarVendas());
    carregarVendas();
  } catch (erro) {
    tratarErro(erro);
  }
}

let vendasAtuais = [];
let vendaDetalheAtual = null;
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

async function atualizarEstadoAtual() {
  try {
    const hoje = new Date();
    const periodoSql = `?inicio=${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01&fim=${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;
    const [dados, doMes, produtos] = await Promise.all([
      requisicaoJSON(`${API()}/relatorios/resumo`, 'GET', null, obterToken()),
      requisicaoJSON(`${API()}/relatorios/resumo${periodoSql}`, 'GET', null, obterToken()),
      requisicaoJSON(`${API()}/produtos`, 'GET', null, obterToken()),
    ]);
    const container = document.getElementById('estado-atual');
    if (!container) return;
    const lucroPresumido = (produtos || []).reduce((s, p) => {
      const qtd = Number(p.estoque) || 0;
      if (qtd <= 0) return s;
      return s + Math.round(((Number(p.preco_venda) || 0) - (Number(p.preco_custo) || 0)) * qtd * 100) / 100;
    }, 0);
    const cardHtml = (rotulo, valor, classe = '', compacto = false) => `
      <div class="card ${compacto ? 'card-qtde' : ''}">
        <span class="card-rotulo">${rotulo}</span>
        <span class="card-valor ${classe}">${valor}</span>
      </div>
    `;
    container.innerHTML = [
      cardHtml('Encomendas abertas', dados.encomendas_abertas),
      cardHtml('A receber (parcelas)', formatarMoeda(dados.parcelas_abertas.valor)),
      cardHtml('Parcelas vencidas', dados.parcelas_vencidas.quantidade),
      cardHtml('Clientes', dados.clientes),
      cardHtml('Produtos', dados.produtos),
      cardHtml('Lucro presumido (estoque)', formatarMoeda(lucroPresumido), 'lucro'),
    ].join('');
  } catch (_) {}
}

function renderVendas() {
  const corpo = document.getElementById('corpo-vendas');
  const pagamento = document.getElementById('filtro-pagamento-venda').value;
  let lista = vendasAtuais;
  if (pagamento) {
    lista = lista.filter((v) => {
      if (v.status === 'cancelada' || v.tipo !== 'venda') return false;
      const quitada = v.parcelas_pagas === v.total_parcelas;
      return pagamento === 'quitada' ? quitada : !quitada;
    });
  }
  if (!lista.length) {
    corpo.innerHTML = `<tr><td colspan="8" class="vazio">${vendasAtuais.length ? 'Nenhuma venda encontrada.' : 'Nenhuma venda encontrada.'}</td></tr>`;
    return;
  }

  corpo.innerHTML = lista
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
            <button class="btn icone" title="Ver detalhes" onclick="abrirDetalheVenda(${v.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
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
  document.querySelectorAll('.modal.modal-detalhe-venda').forEach((m) => m.remove());
  const v = vendaDetalheAtual;
  const modal = document.createElement('div');
  modal.className = 'modal modal-detalhe-venda';
  modal.innerHTML = `
    <div class="modal-conteudo">
      <div class="modal-cabecalho">
        <h2>Venda #${v.id}</h2>
        <button class="modal-fechar" type="button">×</button>
      </div>

      <div class="detalhe-cabecalho">
        <div class="item-data"><div class="rotulo">Data</div><div class="valor">${formatarData(v.criado_em)}</div></div>
        <div class="item-cliente"><div class="rotulo">Cliente</div><div class="valor">${v.cliente_nome || 'Avulso'}</div></div>
        <div class="item-venda"><div class="rotulo">Tipo</div><div class="valor">${v.tipo === 'encomenda' ? 'Encomenda' : 'Venda'}</div></div>
        <div class="item-pagamento"><div class="rotulo">Pagamento</div><div class="valor">${NOME_PAGAMENTO[v.forma_pagamento] || 'À vista'}</div></div>
        <div class="item-status"><div class="rotulo">Status</div><div class="valor">${v.status === 'cancelada' ? 'Cancelada' : v.quitada ? 'Quitada' : 'Ativa'}</div></div>
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
      document.querySelectorAll('.modal.modal-detalhe-venda').forEach((m) => m.remove());
      await carregarVendas();
      await atualizarEstadoAtual();
    } catch (erro) {
      alert(erro.message);
    }
  };

  window.confirmarEncomenda = async (vendaId) => {
    if (!confirm('Confirmar esta encomenda? O estoque será baixado.')) return;
    try {
      await requisicaoJSON(`${API()}/vendas/${vendaId}/confirmar`, 'POST', {}, obterToken());
      document.querySelectorAll('.modal.modal-detalhe-venda').forEach((m) => m.remove());
      const selTipo = document.getElementById('filtro-tipo-venda');
      if (selTipo) selTipo.value = '';
      await carregarVendas();
      await atualizarEstadoAtual();
    } catch (erro) {
      alert(erro.message);
    }
  };

  window.cancelarVenda = async (vendaId) => {
    if (!confirm('Cancelar esta venda? O estoque de vendas será devolvido.')) return;
    try {
      await requisicaoJSON(`${API()}/vendas/${vendaId}`, 'DELETE', null, obterToken());
      document.querySelectorAll('.modal.modal-detalhe-venda').forEach((m) => m.remove());
      await carregarVendas();
      await atualizarEstadoAtual();
    } catch (erro) {
      alert(erro.message);
    }
  };
}
