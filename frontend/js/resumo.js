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
          <span class="card-rotulo">Gastos no mês</span>
          <span class="card-valor gasto">${formatarMoeda(doMes.gastos.total)}</span>
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
      <div class="vazio">Use o menu lateral para acessar as telas.</div>
    `;
  } catch (erro) {
    tratarErro(erro);
  }
}
