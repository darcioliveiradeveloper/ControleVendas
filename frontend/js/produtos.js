registrarTela('produtos', carregarTelaProdutos);

let produtosAtuais = [];

async function carregarTelaProdutos() {
  const tela = document.getElementById('tela-produtos');
  tela.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>Produtos</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="busca-produtos" type="search" placeholder="Buscar produto..." />
          <button class="btn primary" id="btn-novo-produto">+ Novo produto</button>
        </div>
      </div>
      <div id="lista-produtos" class="produtos-grid"></div>
    </div>
  `;

  document.getElementById('busca-produtos').addEventListener('input', (e) => buscarProdutos(e.target.value));
  document.getElementById('btn-novo-produto').addEventListener('click', abrirFormProduto);

  await buscarProdutos('');
}

let timeoutBusca = null;
async function buscarProdutos(texto) {
  clearTimeout(timeoutBusca);
  timeoutBusca = setTimeout(async () => {
    try {
      const busca = texto ? `?busca=${encodeURIComponent(texto)}` : '';
      produtosAtuais = await requisicaoJSON(`${API()}/produtos${busca}`, 'GET', null, obterToken());
      renderProdutos();
    } catch (erro) {
      tratarErro(erro);
    }
  }, 300);
}

function renderProdutos() {
  const lista = document.getElementById('lista-produtos');
  if (!produtosAtuais.length) {
    lista.innerHTML = `<div class="vazio">Nenhum produto cadastrado ainda.</div>`;
    return;
  }

  lista.innerHTML = produtosAtuais
    .map((p) => {
      const foto = urlFoto(p.foto);
      const baixo = Number(p.estoque) <= 5;
      return `
        <div class="produto-card">
          <div class="produto-foto">
            ${foto ? `<img src="${foto}" alt="${p.nome}" />` : 'Sem foto'}
          </div>
          <div class="produto-info">
            <span class="produto-nome">${p.nome}</span>
            ${p.descricao ? `<span class="produto-desc">${p.descricao}</span>` : ''}
            <span class="produto-preco">${formatarMoeda(p.preco_venda)}</span>
            <span class="produto-estoque ${baixo ? 'estoque-baixo' : ''}">Estoque: ${p.estoque}</span>
          </div>
          <div class="produto-acoes">
            <button class="btn editar" onclick="abrirFormProduto(${p.id})">Editar</button>
            <button class="btn excluir" onclick="excluirProduto(${p.id})">Excluir</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function abrirFormProduto(id) {
  const produto = id ? produtosAtuais.find((p) => p.id === id) : null;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-conteudo">
      <div class="modal-cabecalho">
        <h2>${produto ? 'Editar produto' : 'Novo produto'}</h2>
        <button class="modal-fechar" type="button">×</button>
      </div>
      <form id="form-produto">
        <div class="form-grid">
          <div class="field">
            <label>Nome *</label>
            <input name="nome" type="text" required value="${produto ? (produto.nome || '') : ''}" />
          </div>
          <div class="field">
            <label>Descrição</label>
            <textarea name="descricao" rows="2">${produto ? (produto.descricao || '') : ''}</textarea>
          </div>
          <div class="field">
            <label>Preço de custo (R$)</label>
            <input name="preco_custo" type="number" step="0.01" min="0" required value="${produto ? produto.preco_custo : '0'}" />
          </div>
          <div class="field">
            <label>Margem (%)</label>
            <input name="margem_percentual" type="number" step="0.01" min="0" required value="${produto ? produto.margem_percentual : '0'}" />
          </div>
          <div class="field">
            <label>Preço de venda (calculado)</label>
            <input name="preco_venda" type="text" readonly />
          </div>
          <div class="field">
            <label>Estoque inicial</label>
            <input name="estoque" type="number" min="0" value="${produto ? produto.estoque : '0'}" />
          </div>
          <div class="campo-foto">
            <label>Foto</label>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
              <div class="preview-foto" id="preview-foto">${produto && produto.foto ? `<img src="${urlFoto(produto.foto)}" />` : 'Sem foto'}</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <input name="foto" type="file" accept="image/*" />
                ${produto && produto.foto ? `<label class="checkbox-label"><input type="checkbox" name="manter_foto" checked /> Manter foto atual</label>` : ''}
              </div>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn primary">Salvar</button>
          <button type="button" class="btn secondary modal-cancelar">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#form-produto');
  const inputs = {
    custo: form.elements.preco_custo,
    margem: form.elements.margem_percentual,
    venda: form.elements.preco_venda,
  };

  const atualizarPreco = () => {
    const custo = Number(inputs.custo.value) || 0;
    const margem = Number(inputs.margem.value) || 0;
    inputs.venda.value = formatarMoeda(Math.round(custo * (1 + margem / 100) * 100) / 100);
  };
  inputs.custo.addEventListener('input', atualizarPreco);
  inputs.margem.addEventListener('input', atualizarPreco);
  atualizarPreco();

  const fechar = () => modal.remove();
  modal.querySelector('.modal-fechar').addEventListener('click', fechar);
  modal.querySelector('.modal-cancelar').addEventListener('click', fechar);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) fechar();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    if (produto && !formData.get('foto').size) {
      formData.delete('foto');
    }
    try {
      if (produto) {
        await requisicaoForm(`${API()}/produtos/${produto.id}`, 'PUT', formData, obterToken());
      } else {
        await requisicaoForm(`${API()}/produtos`, 'POST', formData, obterToken());
      }
      fechar();
      await buscarProdutos('');
    } catch (erro) {
      alert(erro.message);
    }
  });
}

async function excluirProduto(id) {
  const produto = produtosAtuais.find((p) => p.id === id);
  if (!produto) return;
  if (!confirm(`Excluir o produto "${produto.nome}"? Esta ação não pode ser desfeita.`)) return;
  try {
    await requisicaoJSON(`${API()}/produtos/${id}`, 'DELETE', null, obterToken());
    await buscarProdutos('');
  } catch (erro) {
    tratarErro(erro);
  }
}
