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
        <button class="btn primary" id="btn-novo-produto">+ Novo Produto</button>
        <input id="busca-produtos" type="search" placeholder="Buscar Produto..." />
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
            <button class="btn icone" title="Editar produto" onclick="abrirFormProduto(${p.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
            </button>
            <button class="btn icone excluir" title="Excluir produto" onclick="excluirProduto(${p.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

function escolherOrigemFoto(aoEscolher) {
  const dialogo = document.createElement('div');
  dialogo.className = 'modal';
  dialogo.innerHTML = `
    <div class="modal-conteudo modal-foto-origem">
      <div class="modal-cabecalho">
        <h3>Origem da foto</h3>
        <button class="modal-fechar" type="button">×</button>
      </div>
      <div class="foto-origem-opcoes">
        <button type="button" class="btn secondary" data-origem="camera">Câmera</button>
        <button type="button" class="btn secondary" data-origem="arquivo">Arquivo</button>
        <button type="button" class="btn secondary" data-origem="internet">Internet</button>
      </div>
    </div>
  `;
  const fechar = () => dialogo.remove();
  dialogo.querySelector('.modal-fechar').addEventListener('click', fechar);
  dialogo.querySelectorAll('.foto-origem-opcoes button').forEach((b) => {
    b.addEventListener('click', () => {
      fechar();
      aoEscolher(b.dataset.origem);
    });
  });
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) fechar();
  });
  document.body.appendChild(dialogo);
}

function abrirFormProduto(id) {
  const produto = id ? produtosAtuais.find((p) => p.id === id) : null;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-conteudo">
      <div class="modal-cabecalho">
        <h2>${produto ? 'Editar Produto' : 'Novo Produto'}</h2>
        <button class="modal-fechar" type="button">×</button>
      </div>
      <form id="form-produto">
        <div class="produto-cabeca">
          <div class="foto-bloco">
            <div class="campo-foto">
              <label>Foto</label>
              <div class="preview-foto" id="preview-foto">${produto && produto.foto ? `<img src="${urlFoto(produto.foto)}" />` : `<span class="produto-sem-foto">${SVG_SEM_FOTO}</span>`}</div>
            </div>
            <div class="foto-opcoes">
              <button type="button" class="btn secondary" id="btn-foto">Foto</button>
              <button type="button" class="btn secondary" id="btn-remover-foto">Remover</button>
            </div>
          </div>
          <div class="produto-info">
            <div class="field campo-nome">
              <label>Nome *</label>
              <input name="nome" type="text" required placeholder="Ex.: Body Brilho" value="${produto ? (produto.nome || '') : ''}" />
            </div>
            <div class="field campo-marca">
              <label>Marca</label>
              <input name="marca" type="text" maxlength="10" placeholder="Ex.: Glow" value="${produto ? (produto.marca || '') : ''}" />
            </div>
            <div class="field campo-tipo">
              <label>Tipo</label>
              <input name="tipo" type="text" maxlength="10" placeholder="Ex.: Body, Batom..." value="${produto ? (produto.tipo || '') : ''}" />
            </div>
            <div class="field campo-tamanho">
              <label>Tamanho</label>
              <input name="tamanho" type="text" maxlength="6" placeholder="Ex.: P, M, G" value="${produto ? (produto.tamanho || '') : ''}" />
            </div>
            <div class="field campo-descricao">
              <label>Descrição</label>
              <textarea name="descricao" rows="2">${produto ? (produto.descricao || '') : ''}</textarea>
            </div>
            <div class="field campo-observacoes">
              <label>Observações</label>
              <textarea name="observacoes" rows="2" placeholder="Ex.: Vendido em kit, Validade, Fornecedor...">${produto ? (produto.observacoes || '') : ''}</textarea>
            </div>
          </div>
          <input id="input-foto-camera" type="file" accept="image/*" capture="environment" class="foto-input-escondido" />
          <input id="input-foto" type="file" accept="image/*" class="foto-input-escondido" />
        </div>

        <div class="form-grid">
          <div class="bloco-precos">
            <label>Preços</label>
            <div class="modo-preco">
              <button type="button" class="ativo" data-modo="total">Venda (R$)</button>
              <button type="button" data-modo="valor">Lucro (R$)</button>
              <button type="button" data-modo="percentual">Margem (%)</button>
            </div>
            <div class="precos-linha">
              <div class="precos-grid">
                <div class="field">
                  <label>Custo (R$) *</label>
                  <input name="preco_custo" type="number" step="0.01" min="0" required placeholder="0,00" value="${produto ? produto.preco_custo : ''}" />
                </div>
                <div class="field">
                  <label>Venda (R$)</label>
                  <input name="preco_venda" type="number" step="0.01" min="0" placeholder="0,00" value="${produto ? produto.preco_venda : ''}" />
                </div>
                <div class="field">
                  <label>Lucro (R$)</label>
                  <input name="lucro_valor" type="number" step="0.01" placeholder="0,00" value="${produto ? Math.round((produto.preco_venda - produto.preco_custo) * 100) / 100 : ''}" />
                </div>
                <div class="field">
                  <label>Margem (%)</label>
                  <input name="margem_percentual" type="number" step="0.01" min="0" placeholder="0,00" value="${produto ? produto.margem_percentual : ''}" />
                </div>
              </div>
              <div class="field campo-estoque">
                <label>Estoque ${produto ? 'atual' : 'inicial'}</label>
                <input name="estoque" type="number" min="0" placeholder="0" value="${produto ? produto.estoque : ''}" />
              </div>
            </div>
            <p class="help">Digite o custo e o valor do modo selecionado. O sistema calcula os demais automaticamente.</p>
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
  const btnSalvar = form.querySelector('button[type="submit"]');
  let salvando = false;
  const inputs = {
    custo: form.elements.preco_custo,
    margem: form.elements.margem_percentual,
    venda: form.elements.preco_venda,
    lucro: form.elements.lucro_valor,
  };
  const botoesModo = modal.querySelectorAll('.modo-preco button');
  const inputFotoCamera = modal.querySelector('#input-foto-camera');
  const inputFoto = modal.querySelector('#input-foto');
  const preview = modal.querySelector('#preview-foto');

  let modo = 'total';
  let fotoSelecionada = null;
  let fotoRemovida = false;

  const botaoRemover = modal.querySelector('#btn-remover-foto');

  function atualizarBotaoRemover() {
    botaoRemover.disabled = !(!!(produto && produto.foto) || !!fotoSelecionada);
  }

  function removerFoto() {
    fotoRemovida = true;
    fotoSelecionada = null;
    inputFotoCamera.value = '';
    inputFoto.value = '';
    preview.innerHTML = `<span class="produto-sem-foto">${SVG_SEM_FOTO}</span>`;
    atualizarBotaoRemover();
  }

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

  modal.querySelector('#btn-foto').addEventListener('click', () => {
    escolherOrigemFoto((origem) => {
      if (origem === 'camera') {
        inputFotoCamera.click();
      } else if (origem === 'arquivo') {
        inputFoto.click();
      } else {
        const nome = (form.elements.nome.value || '').trim();
        window.open('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(nome ? nome + ' imagem' : 'imagem'), '_blank');
      }
    });
  });

  function tratarArquivo(arquivo) {
    if (!arquivo) return;
    fotoSelecionada = arquivo;
    const leitor = new FileReader();
    leitor.onload = () => {
      preview.innerHTML = `<img src="${leitor.result}" />`;
    };
    leitor.readAsDataURL(arquivo);
    atualizarBotaoRemover();
  }

  inputFotoCamera.addEventListener('change', () => {
    tratarArquivo(inputFotoCamera.files[0]);
    inputFotoCamera.value = '';
  });
  inputFoto.addEventListener('change', () => {
    tratarArquivo(inputFoto.files[0]);
    inputFoto.value = '';
  });

  botaoRemover.addEventListener('click', removerFoto);
  atualizarBotaoRemover();

  const fechar = () => modal.remove();
  modal.querySelector('.modal-fechar').addEventListener('click', fechar);
  modal.querySelector('.modal-cancelar').addEventListener('click', fechar);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) fechar();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (salvando) return;
    salvando = true;
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';
    const formData = new FormData(form);
    const arquivo = fotoSelecionada;

    if (arquivo) {
      formData.set('foto', arquivo, arquivo.name);
    } else {
      formData.delete('foto');
    }
    if (produto) {
      formData.set('manter_foto', (!fotoRemovida && !arquivo) ? 'true' : 'false');
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
      salvando = false;
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar';
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
