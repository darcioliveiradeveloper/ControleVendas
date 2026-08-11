registrarTela('resumo', carregarTelaResumo);

async function carregarTelaResumo() {
  const tela = document.getElementById('tela-resumo');
  tela.innerHTML = `<div class="vazio">Carregando resumo...</div>`;

  try {
    const dados = await requisicaoJSON(`${API()}/relatorios/resumo`, 'GET', null, obterToken());

    const hoje = new Date();
    const primeiroDia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
    const ultimoDia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${new Date(
      hoje.getFullYear(),
      hoje.getMonth() + 1,
      0
    ).getDate()}`;

    const periodoSql = `?inicio=${primeiroDia}&fim=${ultimoDia}`;
    const doMes = await requisicaoJSON(`${API()}/relatorios/resumo${periodoSql}`, 'GET', null, obterToken());

    const topProdutos = doMes.top_produtos || [];
    const topClientes = doMes.top_clientes || [];

    const lucroLiquido = Number(doMes.lucro_liquido) || 0;

    const renderTopProdutos = () =>
      topProdutos.length
        ? `<div class="table-wrapper">
             <table class="tabela">
               <thead><tr><th>Produto</th><th>Qtd.</th><th>Total</th></tr></thead>
               <tbody>
                 ${topProdutos
                   .map(
                     (p) => `<tr><td>${p.nome}</td><td>${p.quantidade}</td><td>${formatarMoeda(p.total)}</td></tr>`
                   )
                   .join('')}
               </tbody>
             </table>
           </div>`
        : `<div class="vazio">Sem vendas no mês ainda.</div>`;

    const renderTopClientes = () =>
      topClientes.length
        ? `<div class="table-wrapper">
             <table class="tabela">
               <thead><tr><th>Cliente</th><th>Vendas</th><th>Total</th></tr></thead>
               <tbody>
                 ${topClientes
                   .map(
                     (c) => `<tr><td>${c.nome}</td><td>${c.vendas}</td><td>${formatarMoeda(c.total)}</td></tr>`
                   )
                   .join('')}
               </tbody>
             </table>
           </div>`
        : `<div class="vazio">Sem clientes no mês ainda.</div>`;

    tela.innerHTML = `
      <div class="cards-grid">
        <div class="card">
          <span class="card-rotulo">Vendas no mês</span>
          <span class="card-valor">${doMes.vendas.quantidade}</span>
        </div>
        <div class="card">
          <span class="card-rotulo">Faturamento no mês</span>
          <span class="card-valor">${formatarMoeda(doMes.vendas.receita)}</span>
        </div>
        <div class="card">
          <span class="card-rotulo">Lucro no mês</span>
          <span class="card-valor lucro">${formatarMoeda(doMes.vendas.lucro)}</span>
        </div>
        <div class="card">
          <span class="card-rotulo">Despesas no mês</span>
          <span class="card-valor gasto">${formatarMoeda(doMes.despesas.total)}</span>
        </div>
        <div class="card">
          <span class="card-rotulo">Lucro líquido no mês</span>
          <span class="card-valor ${lucroLiquido >= 0 ? 'lucro' : 'gasto'}">${formatarMoeda(lucroLiquido)}</span>
        </div>
        <div class="card">
          <span class="card-rotulo">Encomendas abertas</span>
          <span class="card-valor">${dados.encomendas_abertas}</span>
        </div>
        <div class="card">
          <span class="card-rotulo">A receber (parcelas)</span>
          <span class="card-valor">${formatarMoeda(dados.parcelas_abertas.valor)}</span>
        </div>
        <div class="card">
          <span class="card-rotulo">Parcelas vencidas</span>
          <span class="card-valor">${dados.parcelas_vencidas.quantidade}</span>
        </div>
        <div class="card">
          <span class="card-rotulo">Clientes</span>
          <span class="card-valor">${dados.clientes}</span>
        </div>
        <div class="card">
          <span class="card-rotulo">Produtos</span>
          <span class="card-valor">${dados.produtos}</span>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>Vendas (consulta)</h2>
          <div class="filtros" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input id="busca-venda" type="search" placeholder="Buscar por Cliente..." />
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
      <div class="resumo-top">
        <div class="panel">
          <h2>Produtos mais vendidos do mês</h2>
          ${renderTopProdutos()}
        </div>
        <div class="panel">
          <h2>Top clientes do mês</h2>
          ${renderTopClientes()}
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
