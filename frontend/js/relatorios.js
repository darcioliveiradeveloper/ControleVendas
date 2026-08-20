registrarTela('relatorios', carregarTelaRelatorios);

let relatorioTipo = 'vendas';

async function carregarTelaRelatorios() {
  const tela = document.getElementById('tela-relatorios');
  tela.innerHTML = `
    <div class="panel">
      <div class="panel-head" style="justify-content:flex-start;gap:8px;flex-wrap:nowrap">
        <label style="margin-bottom:2px">De</label>
        <input id="rel-inicio" type="date" style="width:135px" />
        <label style="margin-bottom:2px">Até</label>
        <input id="rel-fim" type="date" style="width:135px" />
        <button class="btn small secondary" data-tipo="vendas">Vendas</button>
        <button class="btn small secondary" data-tipo="gastos">Gastos</button>
        <button class="btn small secondary" data-tipo="parcelas">Parcelas</button>
        <button class="btn small secondary" data-tipo="despesas">Despesas</button>
        <button class="btn small primary" id="btn-aplicar-filtro">Aplicar</button>
        <button class="btn small secondary" id="btn-limpar-filtro">Limpar</button>
      </div>
      <div id="conteudo-relatorio" style="margin-top:16px"></div>
    </div>
  `;

  document.getElementById('btn-aplicar-filtro').addEventListener('click', carregarRelatorio);
  document.getElementById('btn-limpar-filtro').addEventListener('click', () => {
    document.getElementById('rel-inicio').value = '';
    document.getElementById('rel-fim').value = '';
    carregarRelatorio();
  });
  tela.querySelectorAll('[data-tipo]').forEach((b) => {
    if (b.dataset.tipo === relatorioTipo) b.classList.add('ativo');
    b.addEventListener('click', () => {
      tela.querySelectorAll('[data-tipo]').forEach((x) => x.classList.remove('ativo'));
      b.classList.add('ativo');
      relatorioTipo = b.dataset.tipo;
      carregarRelatorio();
    });
  });

  await carregarRelatorio();
}

function dadosPeriodo() {
  const inicio = document.getElementById('rel-inicio').value;
  const fim = document.getElementById('rel-fim').value;
  const params = new URLSearchParams();
  if (inicio) params.set('inicio', inicio);
  if (fim) params.set('fim', fim);
  return params;
}

async function carregarRelatorio() {
  const conteudo = document.getElementById('conteudo-relatorio');
  const params = dadosPeriodo();

  try {
    if (relatorioTipo === 'vendas') {
      const [dadosVendas, dadosDespesas, produtos] = await Promise.all([
        requisicaoJSON(`${API()}/relatorios/vendas?${params}`, 'GET', null, obterToken()),
        requisicaoJSON(`${API()}/relatorios/despesas?${params}`, 'GET', null, obterToken()),
        requisicaoJSON(`${API()}/produtos`, 'GET', null, obterToken()),
      ]);
      conteudo.innerHTML = renderVendasRelatorio(dadosVendas, dadosDespesas, produtos);
    } else if (relatorioTipo === 'parcelas') {
      const dados = await requisicaoJSON(`${API()}/relatorios/parcelas?${params}`, 'GET', null, obterToken());
      conteudo.innerHTML = renderParcelasRelatorio(dados);
    } else if (relatorioTipo === 'despesas') {
      const dados = await requisicaoJSON(`${API()}/relatorios/despesas?${params}`, 'GET', null, obterToken());
      conteudo.innerHTML = renderDespesasRelatorio(dados);
    } else {
      const dados = await requisicaoJSON(`${API()}/relatorios/gastos?${params}`, 'GET', null, obterToken());
      conteudo.innerHTML = renderGastosRelatorio(dados);
    }
  } catch (erro) {
    tratarErro(erro);
  }
}

function lucroPresumidoEstoque(produtos) {
  return (produtos || []).reduce((s, p) => {
    const qtd = Number(p.estoque) || 0;
    if (qtd <= 0) return s;
    const venda = Number(p.preco_venda) || 0;
    const custo = Number(p.preco_custo) || 0;
    return s + Math.round((venda - custo) * qtd * 100) / 100;
  }, 0);
}

function renderVendasRelatorio(vendas, despesas, produtos) {
  const total = vendas.reduce((s, v) => s + Number(v.total), 0);
  const lucro = vendas.reduce((s, v) => s + Number(v.lucro), 0);
  const totalDespesas = (despesas || []).reduce((s, d) => s + Number(d.valor), 0);
  const lucroPresumido = lucroPresumidoEstoque(produtos);

  return `
    <div class="cards-grid cards-consulta" style="margin-bottom:16px">
      <div class="card card-qtde">
        <span class="card-rotulo">Vendas</span>
        <span class="card-valor">${vendas.length}</span>
      </div>
      <div class="card">
        <span class="card-rotulo">Faturamento</span>
        <span class="card-valor">${formatarMoeda(total)}</span>
      </div>
      <div class="card">
        <span class="card-rotulo">Lucro</span>
        <span class="card-valor lucro">${formatarMoeda(lucro)}</span>
      </div>
      <div class="card">
        <span class="card-rotulo">Despesas</span>
        <span class="card-valor gasto">${formatarMoeda(totalDespesas)}</span>
      </div>
      <div class="card">
        <span class="card-rotulo">Lucro presumido (estoque)</span>
        <span class="card-valor lucro">${formatarMoeda(lucroPresumido)}</span>
      </div>
    </div>
    <div class="table-wrapper">
      <table class="tabela">
        <thead>
          <tr><th>#</th><th>Data</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Lucro</th></tr>
        </thead>
        <tbody>
          ${
            vendas.length
              ? vendas
                  .map(
                    (v) => `
                      <tr>
                        <td>#${v.id}</td>
                        <td class="data">${formatarData(v.criado_em)}</td>
                        <td>${v.cliente_nome || 'Avulso'}</td>
                        <td>${v.total_itens}</td>
                        <td>${formatarMoeda(v.total)}</td>
                        <td>${formatarMoeda(v.lucro)}</td>
                      </tr>
                    `
                  )
                  .join('')
              : `<tr><td colspan="6" class="vazio">Nenhuma venda no período.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderParcelasRelatorio(parcelas) {
  const total = parcelas.reduce((s, p) => s + Number(p.valor), 0);

  return `
    <div class="cards-grid" style="margin-bottom:16px">
      <div class="card">
        <span class="card-rotulo">Parcelas em aberto</span>
        <span class="card-valor">${parcelas.length}</span>
      </div>
      <div class="card">
        <span class="card-rotulo">Valor a receber</span>
        <span class="card-valor">${formatarMoeda(total)}</span>
      </div>
    </div>
    <div class="table-wrapper">
      <table class="tabela">
        <thead>
          <tr><th>Vencimento</th><th>Cliente</th><th>Venda</th><th>Nº</th><th>Valor</th></tr>
        </thead>
        <tbody>
          ${
            parcelas.length
              ? parcelas
                  .map(
                    (p) => `
                      <tr>
                        <td class="data">${formatarData(p.data_vencimento)}</td>
                        <td>${p.cliente_nome || 'Avulso'}</td>
                        <td>#${p.venda_id}</td>
                        <td>${p.numero}</td>
                        <td>${formatarMoeda(p.valor)}</td>
                      </tr>
                    `
                  )
                  .join('')
              : `<tr><td colspan="5" class="vazio">Nenhuma parcela em aberto.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderDespesasRelatorio(despesas) {
  const total = despesas.reduce((s, d) => s + Number(d.valor), 0);

  return `
    <div class="cards-grid" style="margin-bottom:16px">
      <div class="card">
        <span class="card-rotulo">Despesas</span>
        <span class="card-valor">${despesas.length}</span>
      </div>
      <div class="card">
        <span class="card-rotulo">Total de despesas</span>
        <span class="card-valor gasto">${formatarMoeda(total)}</span>
      </div>
    </div>
    <div class="table-wrapper">
      <table class="tabela">
        <thead>
          <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr>
        </thead>
        <tbody>
          ${
            despesas.length
              ? despesas
                  .map(
                    (d) => `
                      <tr>
                        <td class="data">${formatarData(d.data)}</td>
                        <td>${d.descricao}</td>
                        <td>${d.categoria || '—'}</td>
                        <td>${formatarMoeda(d.valor)}</td>
                      </tr>
                    `
                  )
                  .join('')
              : `<tr><td colspan="4" class="vazio">Nenhuma despesa no período.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderGastosRelatorio(gastos) {
  const total = gastos.reduce((s, g) => s + Number(g.custo_unitario) * g.quantidade, 0);

  return `
    <div class="cards-grid" style="margin-bottom:16px">
      <div class="card">
        <span class="card-rotulo">Entradas de estoque</span>
        <span class="card-valor">${gastos.length}</span>
      </div>
      <div class="card">
        <span class="card-rotulo">Total gasto</span>
        <span class="card-valor gasto">${formatarMoeda(total)}</span>
      </div>
    </div>
    <div class="table-wrapper">
      <table class="tabela">
        <thead>
          <tr><th>Data</th><th>Produto</th><th>Qtd.</th><th>Custo unit.</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${
            gastos.length
              ? gastos
                  .map(
                    (g) => `
                      <tr>
                        <td class="data">${formatarData(g.criado_em)}</td>
                        <td>${g.produto_nome}</td>
                        <td>${g.quantidade}</td>
                        <td>${formatarMoeda(g.custo_unitario)}</td>
                        <td>${formatarMoeda(g.custo_unitario * g.quantidade)}</td>
                      </tr>
                    `
                  )
                  .join('')
              : `<tr><td colspan="5" class="vazio">Nenhum gasto no período.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}
