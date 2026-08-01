const $ = (id) => document.getElementById(id);

function hojeStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function primeiroDiaDoMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatarData(data) {
  if (!data) return '—';
  const parte = String(data).slice(0, 10).split('-');
  if (parte.length !== 3) return data;
  return parte[2] + '/' + parte[1] + '/' + parte[0];
}

function preencherCards(resumo, prefixo) {
  $(prefixo + '-vendas').textContent = resumo.vendas.quantidade;
  $(prefixo + '-receita').textContent = formatarMoeda(resumo.vendas.receita);
  $(prefixo + '-lucro').textContent = formatarMoeda(resumo.vendas.lucro);
  $(prefixo + '-gastos').textContent = formatarMoeda(resumo.gastos.total);
}

// ---- Dashboard -------------------------------------------------------------

async function carregarDashboard() {
  try {
    const resumo = await requisicaoJSON(`${API}/relatorios/resumo`, 'GET', null, obterToken());
    preencherCards(resumo, 'd');
    $('d-encomendas').textContent = resumo.encomendas_abertas;
    $('d-parcelas').textContent = resumo.parcelas_abertas.quantidade;

    const parcelas = await requisicaoJSON(`${API}/relatorios/parcelas`, 'GET', null, obterToken());
    renderizarParcelas(parcelas, 'corpo-parcelas-dash');

    const texto =
      parcelas.length
        ? `${parcelas.length} pendente(s) · ${formatarMoeda(resumo.parcelas_abertas.valor)} em aberto · ${formatarMoeda(resumo.parcelas_vencidas.valor)} vencido(s)`
        : 'Nenhuma parcela pendente';
    $('d-resumo-parcelas').textContent = texto;
  } catch (erro) {
    $('corpo-parcelas-dash').innerHTML = `<tr><td colspan="5" class="vazio">${escapar(erro.message)}</td></tr>`;
  }
}

// ---- Relatórios --------------------------------------------------------------

function aplicarPeriodo() {
  const inicio = $('r-inicio').value;
  const fim = $('r-fim').value;

  if (inicio && fim && inicio > fim) {
    alert('A data inicial não pode ser maior que a final.');
    return;
  }

  carregarRelatorios(inicio, fim);
}

async function carregarRelatorios(inicio, fim) {
  const params = new URLSearchParams();
  if (inicio) params.set('inicio', inicio);
  if (fim) params.set('fim', fim);
  const query = params.toString() ? '?' + params.toString() : '';

  try {
    const resumo = await requisicaoJSON(`${API}/relatorios/resumo${query}`, 'GET', null, obterToken());
    preencherCards(resumo, 'r');
    $('r-vencidas').textContent =
      `${resumo.parcelas_vencidas.quantidade} (${formatarMoeda(resumo.parcelas_vencidas.valor)})`;
    $('r-cadastros').textContent = `${resumo.clientes} / ${resumo.produtos}`;

    const vendas = await requisicaoJSON(`${API}/relatorios/vendas${query}`, 'GET', null, obterToken());
    renderizarVendasRel(vendas);

    const parcelas = await requisicaoJSON(`${API}/relatorios/parcelas`, 'GET', null, obterToken());
    renderizarParcelas(parcelas, 'corpo-parcelas-rel');

    const gastos = await requisicaoJSON(`${API}/relatorios/gastos${query}`, 'GET', null, obterToken());
    renderizarGastos(gastos);
  } catch (erro) {
    alert(erro.message);
  }
}

function renderizarVendasRel(vendas) {
  const corpo = $('corpo-vendas-rel');
  if (!vendas.length) {
    corpo.innerHTML = '<tr><td colspan="6" class="vazio">Nenhuma venda no período.</td></tr>';
    return;
  }
  corpo.innerHTML = '';
  vendas.forEach((venda) => {
    const tr = document.createElement('tr');
    const tipoLabel = venda.tipo === 'encomenda' ? 'Encomenda' : 'Venda';
    tr.innerHTML =
      `<td class="data">${escapar(formatarData(venda.criado_em))}</td>` +
      `<td>${escapar(venda.cliente_nome || 'Sem cliente')}</td>` +
      `<td>${tipoLabel}</td>` +
      `<td>${venda.total_itens}</td>` +
      `<td><strong>${formatarMoeda(venda.total)}</strong></td>` +
      `<td class="lucro">${formatarMoeda(venda.lucro)}</td>`;
    corpo.appendChild(tr);
  });
}

function renderizarParcelas(parcelas, corpoId) {
  const corpo = $(corpoId);
  if (!parcelas.length) {
    corpo.innerHTML = '<tr><td colspan="5" class="vazio">Nenhuma parcela pendente.</td></tr>';
    return;
  }
  corpo.innerHTML = '';
  parcelas.forEach((parcela) => {
    const tr = document.createElement('tr');
    const vencida = parcela.data_vencimento < hojeStr();
    tr.innerHTML =
      `<td class="data">${escapar(formatarData(parcela.data_vencimento))}</td>` +
      `<td>${escapar(parcela.cliente_nome || 'Sem cliente')}</td>` +
      `<td>${parcela.numero}ª (venda #${parcela.venda_id})</td>` +
      `<td><strong>${formatarMoeda(parcela.valor)}</strong></td>` +
      `<td>${vencida ? '<span class="badge saida">Vencida</span>' : '<span class="badge pendencia">Em aberto</span>'}</td>`;
    corpo.appendChild(tr);
  });
}

function renderizarGastos(gastos) {
  const corpo = $('corpo-gastos-rel');
  if (!gastos.length) {
    corpo.innerHTML = '<tr><td colspan="6" class="vazio">Nenhuma compra de estoque no período.</td></tr>';
    return;
  }
  corpo.innerHTML = '';
  gastos.forEach((gasto) => {
    const tr = document.createElement('tr');
    const total = (gasto.custo_unitario || 0) * gasto.quantidade;
    tr.innerHTML =
      `<td class="data">${escapar(formatarData(gasto.criado_em))}</td>` +
      `<td>${escapar(gasto.produto_nome)}</td>` +
      `<td>${gasto.quantidade}</td>` +
      `<td>${formatarMoeda(gasto.custo_unitario || 0)}</td>` +
      `<td><strong>${formatarMoeda(total)}</strong></td>` +
      `<td>${escapar(gasto.observacao || '—')}</td>`;
    corpo.appendChild(tr);
  });
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// ---- Início -----------------------------------------------------------------

$('btn-aplicar-periodo').addEventListener('click', aplicarPeriodo);

$('r-inicio').value = primeiroDiaDoMes();
$('r-fim').value = hojeStr();

carregarDashboard();
carregarRelatorios($('r-inicio').value, $('r-fim').value);
