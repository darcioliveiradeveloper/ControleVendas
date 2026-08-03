registrarTela('produtos', carregarTelaProdutos);

let produtosAtuais = [];

const SVG_SEM_FOTO = `
  <svg viewBox="0 0 100 100" width="64" height="64" aria-hidden="true">
    <circle cx="50" cy="37" r="13" fill="#e8b7c9" />
    <path d="M28 80 a22 22 0 0 1 44 0 z" fill="#e8b7c9" />
    <circle cx="50" cy="37" r="21" fill="none" stroke="#d9a3bb" stroke-width="2" opacity="0.6" />
    <path d="M50 5 l3.2 7.5 7.5 3.2 -7.5 3.2 -3.2 7.5 -3.2 -7.5 -7.5 -3.2 7.5 -3.2 z" fill="#e75480" opacity="0.85" />
  </svg>
`;

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
      const meta = [p.marca, p.tipo, p.tamanho].filter(Boolean).join(' · ');
      return `
        <div class="produto-card">
          <div class="produto-foto">
            ${foto ? `<img src="${foto}" alt="${p.nome}" />` : `<span class="produto-sem-foto">${SVG_SEM_FOTO}</span>`}
          </div>
          <div class="produto-info">
            <span class="produto-nome">${p.nome}</span>
            ${meta ? `<span class="produto-meta">${meta}</span>` : ''}
            ${p.descricao ? `<span class="produto-desc">${p.descricao}</span>` : ''}
            ${p.observacoes ? `<span class="produto-desc">📌 ${p.observacoes}</span>` : ''}
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
            <input name="nome" type="text" required placeholder="Ex.: Body brilho" value="${produto ? (produto.nome || '') : ''}" />
          </div>
          <div class="field">
            <label>Marca</label>
            <input name="marca" type="text" placeholder="Ex.: Glow" value="${produto ? (produto.marca || '') : ''}" />
          </div>
          <div class="field">
            <label>Tipo</label>
            <input name="tipo" type="text" placeholder="Ex.: Body, Batom..." value="${produto ? (produto.tipo || '') : ''}" />
          </div>
          <div class="field">
            <label>Tamanho</label>
            <input name="tamanho" type="text" placeholder="Ex.: P, M, G, 200ml" value="${produto ? (produto.tamanho || '') : ''}" />
          </div>
          <div class="field">
            <label>Descrição</label>
            <textarea name="descricao" rows="2">${produto ? (produto.descricao || '') : ''}</textarea>
          </div>
          <div class="field">
            <label>Observações</label>
            <textarea name="observacoes" rows="2" placeholder="Ex.: vendido em kit, validade, fornecedor...">${produto ? (produto.observacoes || '') : ''}</textarea>
          </div>

          <div class="bloco-precos">
            <label>Preços</label>
            <div class="modo-preco">
              <button type="button" class="ativo" data-modo="percentual">Margem (%)</button>
              <button type="button" data-modo="valor">Lucro (R$)</button>
              <button type="button" data-modo="total">Venda (R$)</button>
            </div>
            <div class="precos-grid">
              <div class="field">
                <label>Custo (R$) *</label>
                <input name="preco_custo" type="number" step="0.01" min="0" required placeholder="0,00" value="${produto ? produto.preco_custo : ''}" />
              </div>
              <div class="field">
                <label>Margem (%)</label>
                <input name="margem_percentual" type="number" step="0.01" min="0" placeholder="0,00" value="${produto ? produto.margem_percentual : ''}" />
              </div>
              <div class="field">
                <label>Venda (R$)</label>
                <input name="preco_venda" type="number" step="0.01" min="0" placeholder="0,00" value="${produto ? produto.preco_venda : ''}" />
              </div>
              <div class="field">
                <label>Lucro (R$)</label>
                <input name="lucro_valor" type="number" step="0.01" placeholder="0,00" value="${produto ? Math.round((produto.preco_venda - produto.preco_custo) * 100) / 100 : ''}" />
              </div>
            </div>
            <p class="help">Digite o custo e o valor do modo selecionado. O sistema calcula os demais automaticamente.</p>
          </div>

          <div class="field">
            <label>Estoque ${produto ? 'atual' : 'inicial'}</label>
            <input name="estoque" type="number" min="0" placeholder="0" value="${produto ? produto.estoque : ''}" />
          </div>
        </div>

        <div class="campo-foto">
          <label>Foto</label>
          <div class="foto-linha">
            <div class="preview-foto" id="preview-foto">${produto && produto.foto ? `<img src="${urlFoto(produto.foto)}" />` : `<span class="produto-sem-foto">${SVG_SEM_FOTO}</span>`}</div>
            <div class="foto-controles">
              <div class="foto-opcoes">
                <button type="button" class="btn secondary" id="btn-foto-camera">Câmera</button>
                <button type="button" class="btn secondary" id="btn-foto-arquivo">Arquivo</button>
                <button type="button" class="btn secondary" id="btn-foto-link">Buscar na internet</button>
                ${produto && produto.foto ? '<button type="button" class="btn secondary" id="btn-remover-foto">Remover foto</button>' : ''}
              </div>
              <input id="input-foto" type="file" accept="image/*" hidden />
              <div class="foto-url" id="foto-url" hidden>
                <input name="foto_url" type="url" placeholder="Cole aqui o link da imagem" />
                <p class="help">Abriu o Google com o nome do produto? Escolha a imagem, copie o endereço e cole aqui.</p>
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
    lucro: form.elements.lucro_valor,
  };
  const botoesModo = modal.querySelectorAll('.modo-preco button');
  const inputFoto = modal.querySelector('#input-foto');
  const preview = modal.querySelector('#preview-foto');
  const areaUrl = modal.querySelector('#foto-url');
  const inputUrl = form.elements.foto_url;

  let modo = 'percentual';
  let fotoSelecionada = null;
  let fotoRemovida = false;

  const num = (el) => Number(el.value) || 0;
  const round2 = (n) => Math.round(n * 100) / 100;

  function sincronizar() {
    const c = num(inputs.custo);
    let m;
    let l;
    let v;
    if (modo === 'valor') {
      l = num(inputs.lucro);
      v = round2(c + l);
      m = c ? round2((l / c) * 100) : 0;
    } else if (modo === 'total') {
      v = num(inputs.venda);
      l = round2(v - c);
      m = c ? round2((l / c) * 100) : 0;
    } else {
      m = num(inputs.margem);
      v = round2(c * (1 + m / 100));
      l = round2(v - c);
    }
    inputs.margem.value = m;
    inputs.lucro.value = l;
    inputs.venda.value = v;
  }

  function aplicarModo() {
    botoesModo.forEach((b) => b.classList.toggle('ativo', b.dataset.modo === modo));
    inputs.margem.readOnly = modo !== 'percentual';
    inputs.lucro.readOnly = modo !== 'valor';
    inputs.venda.readOnly = modo !== 'total';
  }

  botoesModo.forEach((b) => {
    b.addEventListener('click', () => {
      modo = b.dataset.modo;
      aplicarModo();
      sincronizar();
    });
  });

  inputs.custo.addEventListener('input', sincronizar);
  inputs.margem.addEventListener('input', sincronizar);
  inputs.lucro.addEventListener('input', sincronizar);
  inputs.venda.addEventListener('input', sincronizar);
  aplicarModo();

  modal.querySelector('#btn-foto-camera').addEventListener('click', () => {
    inputFoto.setAttribute('capture', 'environment');
    inputFoto.click();
  });
  modal.querySelector('#btn-foto-arquivo').addEventListener('click', () => {
    inputFoto.removeAttribute('capture');
    inputFoto.click();
  });
  modal.querySelector('#btn-foto-link').addEventListener('click', () => {
    const nome = (form.elements.nome.value || '').trim();
    window.open('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(nome ? nome + ' imagem' : 'imagem'), '_blank');
    areaUrl.hidden = false;
    inputUrl.focus();
  });

  inputFoto.addEventListener('change', () => {
    const arquivo = inputFoto.files[0];
    if (!arquivo) return;
    fotoSelecionada = arquivo;
    inputUrl.value = '';
    areaUrl.hidden = true;
    const leitor = new FileReader();
    leitor.onload = () => {
      preview.innerHTML = `<img src="${leitor.result}" />`;
    };
    leitor.readAsDataURL(arquivo);
  });

  let timeoutUrl;
  inputUrl.addEventListener('input', () => {
    clearTimeout(timeoutUrl);
    timeoutUrl = setTimeout(() => {
      const url = inputUrl.value.trim();
      if (!/^https?:\/\//i.test(url)) return;
      const img = new Image();
      img.onload = () => {
        preview.innerHTML = `<img src="${url}" />`;
        fotoSelecionada = null;
        inputFoto.value = '';
        fotoRemovida = false;
      };
      img.src = url;
    }, 500);
  });

  const botaoRemover = modal.querySelector('#btn-remover-foto');
  if (botaoRemover) {
    botaoRemover.addEventListener('click', () => {
      fotoRemovida = true;
      fotoSelecionada = null;
      inputFoto.value = '';
      inputUrl.value = '';
      areaUrl.hidden = true;
      preview.innerHTML = `<span class="produto-sem-foto">${SVG_SEM_FOTO}</span>`;
    });
  }

  const fechar = () => modal.remove();
  modal.querySelector('.modal-fechar').addEventListener('click', fechar);
  modal.querySelector('.modal-cancelar').addEventListener('click', fechar);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) fechar();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const arquivo = inputFoto.files[0];
    const url = inputUrl.value.trim();

    if (arquivo) {
      formData.set('foto', arquivo, arquivo.name);
    } else {
      formData.delete('foto');
    }
    if (!/^https?:\/\//i.test(url)) {
      formData.delete('foto_url');
    }
    if (produto) {
      formData.set('manter_foto', (!fotoRemovida && !arquivo && !/^https?:\/\//i.test(url)) ? 'true' : 'false');
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
