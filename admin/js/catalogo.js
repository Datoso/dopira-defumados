/* =====================================================================
   Dopira Gestão · Catálogo e estoque
   Telas: #/catalogo (lista, filtros, ajuste rápido de estoque)
          #/produto/ID (edição, promoções, estoque e histórico)
   ===================================================================== */
(function () {
'use strict';
const { $, $$, esc, ICON } = UI;
window.TELAS = window.TELAS || {};
const TELAS = window.TELAS;

/* ---------- estado da tela (só nesta sessão) ---------- */
const vista = { filtro: 'todos', busca: '' };
const histMostrar = {};          // prodId → quantos movimentos mostrar
const PASSO_HIST = 15;
const ABERTOS = ['novo', 'confirmado', 'pronto'];

/* ---------- utilidades locais ---------- */
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const chaveBusca = s => semAcento(s).toLowerCase().trim();
const unid = p => p.venda === 'un' ? 'un' : 'kg';
const porUnid = p => p.venda === 'un' ? '/un' : '/kg';
const SIT = { ok: { rot: 'Em estoque', cls: 'tag-ok' }, baixo: { rot: 'Estoque baixo', cls: 'tag-baixo' }, zerado: { rot: 'Zerado', cls: 'tag-zerado' } };
const tagSit = p => { const s = SIT[D.situacaoEstoque(p)]; return `<span class="pill ${s.cls}">${s.rot}</span>`; };
const tagInativo = '<span class="pill cat-tag-inativo">Inativo</span>';

function idDoNome(nome) {
  let base = semAcento(nome).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'produto';
  let id = base, n = 2;
  while (D.produto(id)) id = `${base}-${n++}`;
  return id;
}
function nomeRepetido(nome, ignorarId) {
  const k = chaveBusca(nome);
  return D.estado.produtos.some(p => p.id !== ignorarId && chaveBusca(p.nome) === k);
}
function textoEstoque(p) {
  const pc = D.pecasEstimadas(p);
  return `<span class="num cat-est-val">${esc(D.qtd(p.estoque || 0, p.venda))}</span>${pc !== null ? `<span class="cat-est-pc">≈ ${pc} ${pc === 1 ? 'peça' : 'peças'}</span>` : ''}`;
}
function origemDesconto(d) {
  if (!d.pct) return '';
  return d.origem === 'promocao' && d.promo ? `Promoção: ${d.promo.nome || 'sem nome'}` : 'Desconto do produto';
}
/** Bloco de preço (lista e cabeçalho do produto). */
function htmlPreco(p, grande = false) {
  if (p.preco === null || p.preco === undefined) return `<span class="cat-sem-preco">Definir preço</span>`;
  const d = D.descontoDo(p), ef = D.precoEfetivo(p);
  if (!d.pct) return `<span class="cat-preco${grande ? ' g' : ''}"><b class="num">${esc(D.reais(p.preco))}</b><small>${porUnid(p)}</small></span>`;
  return `<span class="cat-preco${grande ? ' g' : ''}"><s>${esc(D.reais(p.preco))}</s> <b class="num">${esc(D.reais(ef))}</b><small>${porUnid(p)}</small></span>
    <span class="cat-desc"><span class="pill tag-promo">−${esc(D.fmtNum(d.pct, 1))}%</span><span>${esc(origemDesconto(d))}</span></span>`;
}

/* ---------- filtros ---------- */
const FILTROS = [
  { id: 'todos',    nome: 'Todos',         f: () => true },
  { id: 'baixo',    nome: 'Estoque baixo', f: p => p.ativo && D.situacaoEstoque(p) !== 'ok' },
  { id: 'sempreco', nome: 'Sem preço',     f: p => p.ativo && (p.preco === null || p.preco === undefined) },
  { id: 'promo',    nome: 'Em promoção',   f: p => p.ativo && D.descontoDo(p).pct > 0 },
  { id: 'inativos', nome: 'Inativos',      f: p => !p.ativo }
];
function listaFiltrada() {
  const fl = (FILTROS.find(x => x.id === vista.filtro) || FILTROS[0]).f;
  const q = chaveBusca(vista.busca);
  return D.estado.produtos.filter(p => fl(p) && (!q || chaveBusca(p.nome).includes(q)));
}

/* ---------- cartão de produto ---------- */
function cartao(p) {
  return `<article class="cat-card${p.ativo ? '' : ' inativo'}">
    <a class="cat-topo" href="#/produto/${encodeURIComponent(p.id)}">
      ${UI.miniatura(p, 64)}
      <div class="cat-info">
        <b class="cat-nome">${esc(p.nome)}</b>
        <div class="cat-precos">${htmlPreco(p)}</div>
      </div>
      <span class="cat-seta">${ICON.seta}</span>
    </a>
    <div class="cat-rodape">
      <div class="cat-est">${textoEstoque(p)}<span class="cat-tags">${p.ativo ? '' : tagInativo}${tagSit(p)}</span></div>
      <button type="button" class="btn btn-2 btn-sm cat-ajustar" data-ajustar="${esc(p.id)}" aria-label="Ajustar estoque de ${esc(p.nome)}">${ICON.caixa}<span>Estoque</span></button>
    </div>
  </article>`;
}
function htmlLista() {
  const l = listaFiltrada();
  if (!l.length) {
    if (!D.estado.produtos.length) return UI.vazio('Nenhum produto', 'Cadastre o primeiro produto do catálogo.', '<button type="button" class="btn btn-1" data-novo>Novo produto</button>');
    return UI.vazio('Nenhum produto aqui', vista.busca ? `Nada encontrado para “${vista.busca}”.` : 'Nenhum produto neste filtro.',
      '<button type="button" class="btn btn-2" data-limpar>Ver todos</button>');
  }
  return `<div class="cat-grade">${l.map(cartao).join('')}</div>`;
}
function htmlStats() {
  const ps = D.estado.produtos, at = ps.filter(p => p.ativo);
  const sem = at.filter(p => p.preco === null || p.preco === undefined).length;
  const baixo = at.filter(p => D.situacaoEstoque(p) === 'baixo').length;
  const zer = at.filter(p => D.situacaoEstoque(p) === 'zerado').length;
  const st = (rot, val, sub, filtro, alerta) => `<button type="button" class="stat cat-stat" data-filtro="${filtro}" ${alerta ? 'data-alerta' : ''} aria-label="${esc(`${rot}: ${val}. Filtrar`)}">
      <span class="rot">${esc(rot)}</span><span class="val">${val}</span><span class="sub">${esc(sub)}</span></button>`;
  return `<div class="stats cat-stats">
    ${st('Produtos ativos', at.length, `de ${ps.length} no catálogo`, 'todos', false)}
    ${st('Sem preço', sem, sem ? 'defina para vender' : 'todos com preço', 'sempreco', sem > 0)}
    ${st('Estoque baixo', baixo, 'no mínimo ou abaixo', 'baixo', baixo > 0)}
    ${st('Zerados', zer, zer ? 'sem nada em estoque' : 'nenhum zerado', 'baixo', zer > 0)}
  </div>`;
}
function htmlChips() {
  return FILTROS.map(f => {
    const n = D.estado.produtos.filter(f.f).length;
    return `<button type="button" class="chip" data-chip="${f.id}" aria-pressed="${vista.filtro === f.id}">${f.nome}<span class="n">${n}</span></button>`;
  }).join('');
}

TELAS.catalogo = {
  titulo: 'Catálogo', nav: 'catalogo',
  render() {
    return `<div class="cab">
        <div><h2>Catálogo</h2><p>Preços, descontos e estoque dos produtos.</p></div>
        <button type="button" class="btn btn-1" data-novo>${ICON.mais}Novo produto</button>
      </div>
      <div id="catStats">${htmlStats()}</div>
      <div class="cat-ferr">
        <label class="cat-busca"><span class="sr">Buscar produto pelo nome</span>${ICON.busca}
          <input type="search" id="catBusca" placeholder="Buscar produto" value="${esc(vista.busca)}" autocomplete="off" enterkeyhint="search"></label>
        <div class="chips" role="group" aria-label="Filtrar produtos" id="catChips">${htmlChips()}</div>
      </div>
      <div id="catLista" aria-live="polite">${htmlLista()}</div>`;
  },
  montar(el) {
    const atualizar = () => {
      $('#catLista', el).innerHTML = htmlLista();
      $('#catChips', el).innerHTML = htmlChips();
      $('#catStats', el).innerHTML = htmlStats();
    };
    $('#catBusca', el).addEventListener('input', e => { vista.busca = e.target.value; $('#catLista', el).innerHTML = htmlLista(); });
    el.addEventListener('click', async e => {
      const t = e.target;
      const chip = t.closest('[data-chip]');
      if (chip) { vista.filtro = chip.dataset.chip; return atualizar(); }
      const stat = t.closest('[data-filtro]');
      if (stat) { vista.filtro = stat.dataset.filtro; atualizar(); $('#catChips', el).scrollIntoView({ block: 'nearest', behavior: UI.reduz.matches ? 'auto' : 'smooth' }); return; }
      if (t.closest('[data-limpar]')) { vista.filtro = 'todos'; vista.busca = ''; $('#catBusca', el).value = ''; return atualizar(); }
      if (t.closest('[data-novo]')) return novoProduto();
      const aj = t.closest('[data-ajustar]');
      if (aj) {
        const id = aj.dataset.ajustar;
        if (await dialogoEstoque(id)) {
          atualizar();
          const b = $(`[data-ajustar="${CSS.escape(id)}"]`, el); if (b) b.focus({ preventScroll: true });
        }
      }
    });
  }
};

/* ---------- diálogo: novo produto ---------- */
function novoProduto() {
  let criado = null;
  return UI.abrirDialogo({
    titulo: 'Novo produto',
    html: `<form class="form" novalidate>
      ${UI.campo({ id: 'npNome', rotulo: 'Nome do produto', attrs: 'autocomplete="off" maxlength="60"' })}
      <div class="campo"><span class="cat-rot" id="npVendaRot">Vendido por</span>
        <div class="seg" role="radiogroup" aria-labelledby="npVendaRot">
          <label><input type="radio" name="npVenda" value="kg" checked><span>Peso (kg)</span></label>
          <label><input type="radio" name="npVenda" value="un"><span>Unidade</span></label>
        </div></div>
      ${UI.campo({ id: 'npPreco', rotulo: 'Preço', sufixo: 'R$/kg', dica: 'Pode deixar em branco e definir depois.', attrs: 'inputmode="decimal" autocomplete="off" placeholder="0,00"' })}
    </form>`,
    botoes: [
      { texto: 'Cancelar', classe: 'btn-2', valor: null },
      { texto: 'Criar produto', classe: 'btn-1', valor: 'ok', antes(d) {
        limparErros(d);
        const nome = $('#npNome', d).value.trim().replace(/\s+/g, ' ');
        const venda = $('input[name="npVenda"]:checked', d).value;
        const txtP = $('#npPreco', d).value.trim();
        const preco = txtP ? D.num(txtP) : null;
        let ok = true;
        if (!nome) ok = erro(d, 'npNome', 'Informe o nome.') && false;
        else if (nomeRepetido(nome)) ok = erro(d, 'npNome', 'Já existe um produto com esse nome.') && false;
        if (txtP && (preco === null || preco < 0)) ok = erro(d, 'npPreco', 'Preço inválido. Use números, ex.: 89,90') && false;
        if (!ok) { focarErro(d); return false; }
        criado = D.produtoBase({ id: idDoNome(nome), nome, venda, preco: preco === null ? null : D.arred(preco) });
        D.estado.produtos.push(criado);
        D.salvar();
      } }
    ],
    montar(d) {
      $$('input[name="npVenda"]', d).forEach(r => r.addEventListener('change', () => {
        $('#npPreco', d).nextElementSibling.textContent = r.value === 'un' ? 'R$/un' : 'R$/kg';
      }));
    }
  }).then(v => {
    if (v === 'ok' && criado) { UI.toast(`${criado.nome} criado`); UI.ir(`#/produto/${encodeURIComponent(criado.id)}`); }
  });
}

/* ---------- erros de campo ---------- */
function erro(raiz, id, msg) {
  const inp = $('#' + id, raiz); if (!inp) return true;
  const c = inp.closest('.campo'); c.setAttribute('data-erro', '');
  inp.setAttribute('aria-invalid', 'true');
  let m = $('.cat-erro', c);
  if (!m) { m = document.createElement('small'); m.className = 'cat-erro'; m.id = id + 'Erro'; c.appendChild(m); }
  m.textContent = msg; inp.setAttribute('aria-describedby', m.id);
  return true;
}
function limparErros(raiz) {
  $$('.campo[data-erro]', raiz).forEach(c => c.removeAttribute('data-erro'));
  $$('[aria-invalid]', raiz).forEach(i => { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby'); });
  $$('.cat-erro', raiz).forEach(m => m.remove());
}
function focarErro(raiz) { const i = $('[aria-invalid="true"]', raiz); if (i) i.focus(); }

/* ---------- diálogo: ajuste de estoque (entrada / saída / contagem) ---------- */
const MODOS = {
  entrada:  { rot: 'Entrada',  sinal: '+', campo: 'Quantidade que entrou', padrao: 'Entrada' },
  saida:    { rot: 'Saída',    sinal: '−', campo: 'Quantidade que saiu', padrao: 'Saída' },
  contagem: { rot: 'Contagem', sinal: '=', campo: 'Quanto tem agora (contado)', padrao: 'Contagem' }
};
const SUGESTOES = ['Fornada', 'Perda', 'Consumo', 'Contagem'];

function dialogoEstoque(prodId, modoIni = 'entrada') {
  const p = D.produto(prodId); if (!p) return Promise.resolve(false);
  const u = unid(p);
  let feito = null;
  return UI.abrirDialogo({
    titulo: 'Ajustar estoque',
    html: `<form class="form aj" novalidate>
      <div class="aj-prod">${UI.miniatura(p, 44)}<div><b>${esc(p.nome)}</b><span>Agora: <b class="num">${esc(D.qtd(p.estoque || 0, p.venda))}</b></span></div></div>
      <div class="seg aj-seg" role="radiogroup" aria-label="Tipo de ajuste">
        ${Object.entries(MODOS).map(([k, m]) => `<label><input type="radio" name="ajModo" value="${k}" ${k === modoIni ? 'checked' : ''}><span><b aria-hidden="true">${m.sinal}</b>${m.rot}</span></label>`).join('')}
      </div>
      ${UI.campo({ id: 'ajQtd', rotulo: MODOS[modoIni].campo, sufixo: u, attrs: `inputmode="${u === 'un' ? 'numeric' : 'decimal'}" autocomplete="off" placeholder="${u === 'un' ? '0' : '0,000'}"`, valor: modoIni === 'contagem' ? D.paraInput(p.estoque || 0) : '' })}
      <p class="aj-prev" id="ajPrev" aria-live="polite"></p>
      <div class="campo">
        ${UI.campo({ id: 'ajMotivo', rotulo: 'Motivo (opcional)', attrs: 'autocomplete="off" maxlength="60" placeholder="Ex.: Fornada de sábado"' }).replace(/^<div class="campo">|<\/div>$/g, '')}
        <div class="aj-sug" role="group" aria-label="Sugestões de motivo">${SUGESTOES.map(s => `<button type="button" class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      </div>
    </form>`,
    botoes: [
      { texto: 'Cancelar', classe: 'btn-2', valor: null },
      { texto: 'Aplicar', classe: 'btn-1', valor: 'ok', antes(d) {
        limparErros(d);
        const modo = $('input[name="ajModo"]:checked', d).value;
        const q = D.num($('#ajQtd', d).value);
        const atual = p.estoque || 0;
        let msg = '';
        if (q === null) msg = 'Informe a quantidade (ex.: 2,5).';
        else if (q < 0) msg = 'Use um número positivo.';
        else if (modo !== 'contagem' && q === 0) msg = 'A quantidade precisa ser maior que zero.';
        else if (u === 'un' && !Number.isInteger(q)) msg = 'Produto vendido por unidade: use um número inteiro.';
        else if (modo === 'saida' && q > atual + 1e-9) msg = `Saída maior que o estoque atual (${D.qtd(atual, p.venda)}). Use Contagem para corrigir o valor.`;
        if (msg) { erro(d, 'ajQtd', msg); focarErro(d); return false; }
        const delta = modo === 'entrada' ? q : modo === 'saida' ? -q : D.arred(q - atual, 3);
        let motivo = $('#ajMotivo', d).value.trim().replace(/\s+/g, ' ');
        if (!motivo) motivo = MODOS[modo].padrao;
        else if (modo === 'contagem' && !/contagem/i.test(motivo)) motivo = `Contagem · ${motivo}`;
        feito = { modo, delta, q };
        if (delta) { D.ajustarEstoque(p.id, delta, motivo); D.salvar(); }
      } }
    ],
    montar(d) {
      const inp = $('#ajQtd', d), prev = $('#ajPrev', d), rot = $('label[for="ajQtd"]', d);
      const calc = () => {
        const modo = $('input[name="ajModo"]:checked', d).value, q = D.num(inp.value), atual = p.estoque || 0;
        if (q === null || q < 0) { prev.textContent = ''; return; }
        const novo = modo === 'entrada' ? atual + q : modo === 'saida' ? atual - q : q;
        const dl = D.arred(novo - atual, 3);
        prev.innerHTML = `Fica <b class="num">${esc(D.qtd(D.arred(novo, 3), p.venda))}</b>${modo === 'contagem' && dl ? ` <span class="${dl > 0 ? 'mais' : 'menos'}">(${dl > 0 ? '+' : '−'}${esc(D.qtd(Math.abs(dl), p.venda))})</span>` : ''}${novo < 0 ? ' · <span class="menos">ficaria negativo</span>' : ''}`;
      };
      $$('input[name="ajModo"]', d).forEach(r => r.addEventListener('change', () => {
        rot.textContent = MODOS[r.value].campo;
        inp.value = r.value === 'contagem' ? D.paraInput(p.estoque || 0) : '';
        limparErros(d); calc();
        if (matchMedia('(pointer:fine)').matches) inp.focus();
      }));
      inp.addEventListener('input', calc);
      $$('[data-sug]', d).forEach(b => b.addEventListener('click', () => {
        $('#ajMotivo', d).value = b.dataset.sug;
        $$('[data-sug]', d).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      }));
      calc();
      if (matchMedia('(pointer:fine)').matches) setTimeout(() => { inp.focus(); inp.select(); }, 0);
    }
  }).then(v => {
    if (v !== 'ok' || !feito) return false;
    const pr = D.produto(prodId);
    if (!feito.delta) { UI.toast(`Estoque de ${pr.nome} já estava em ${D.qtd(pr.estoque, pr.venda)}`); return false; }
    const txt = feito.modo === 'contagem' ? `Estoque de ${pr.nome} definido em ${D.qtd(pr.estoque, pr.venda)}`
      : `${feito.modo === 'entrada' ? '+' : '−'}${D.qtd(feito.q, pr.venda)} · ${pr.nome} agora com ${D.qtd(pr.estoque, pr.venda)}`;
    UI.toast(txt);
    return true;
  });
}

/* ---------- tela do produto ---------- */
function htmlPromos(p) {
  const ps = D.promocoesDo(p);
  const d = D.descontoDo(p);
  if (!ps.length) return `<p class="muted pd-promo-vazio">Nenhuma promoção ativa para este produto. <a class="btn-link" href="#/promocoes">Ver promoções</a></p>`;
  return `<ul class="pd-promos">${ps.map(pr => `<li>
      <span class="pill tag-promo">−${esc(D.fmtNum(Number(pr.desconto) || 0, 1))}%</span>
      <div><b>${esc(pr.nome || 'Promoção')}</b><span>${pr.produtos && pr.produtos.length ? 'Só produtos escolhidos' : 'Todo o catálogo'}${pr.fim ? ` · até ${esc(D.fmtData(pr.fim))}` : ''}${d.promo === pr ? ' · <strong>em uso</strong>' : ''}</span></div>
    </li>`).join('')}</ul>
    <p class="dica pd-nota">Descontos não somam: vale o maior entre o do produto e o das promoções.</p>
    <a class="btn-link" href="#/promocoes">Gerenciar promoções</a>`;
}
function htmlHistorico(p) {
  const movs = D.estado.movs.filter(m => m.prod === p.id);
  if (!movs.length) return `<p class="muted pd-hist-vazio">Nenhum movimento registrado ainda.</p>`;
  const n = histMostrar[p.id] || PASSO_HIST;
  return `<ol class="pd-hist">${movs.slice(0, n).map(m => {
      const ped = m.pedido ? D.pedido(m.pedido) : null;
      const pos = m.delta > 0;
      return `<li>
        <div class="pd-h-meio"><b>${esc(m.motivo || (pos ? 'Entrada' : 'Saída'))}</b>
          <span><time datetime="${esc(m.t)}">${esc(D.fmtDataHora(m.t))}</time>${ped ? ` · <a href="#/pedido/${encodeURIComponent(ped.id)}">Pedido #${esc(ped.num)}</a>` : ''}</span></div>
        <span class="num pd-h-d ${pos ? 'mais' : 'menos'}">${pos ? '+' : '−'}${esc(D.qtd(Math.abs(m.delta), p.venda))}</span>
      </li>`; }).join('')}</ol>
    ${movs.length > n ? `<button type="button" class="btn btn-2 btn-sm pd-mais" data-vermais>Ver mais (${movs.length - n})</button>` : ''}`;
}
function htmlEstoque(p) {
  const pc = D.pecasEstimadas(p), s = D.situacaoEstoque(p);
  return `<div class="card-escuro pd-est pd-est-${s}">
      <div class="pd-est-topo"><span class="pd-est-rot">Estoque atual</span>${tagSit(p)}</div>
      <div class="pd-est-val num">${esc(D.fmtNum(p.estoque || 0, p.venda === 'un' ? 0 : 3))}<small>${unid(p)}</small></div>
      <p class="pd-est-sub">${pc !== null ? `≈ ${pc} ${pc === 1 ? 'peça' : 'peças'} (peça média ${esc(D.fmtNum(p.pesoMedio))} kg)` : (p.venda === 'kg' ? 'Informe o peso médio da peça para estimar as peças' : 'Contado em unidades')}${p.estoqueMin > 0 ? ` · alerta em ${esc(D.qtd(p.estoqueMin, p.venda))}` : ''}</p>
      <div class="pd-est-acoes">
        <button type="button" class="btn btn-1" data-mov="entrada">${ICON.mais}Entrada</button>
        <button type="button" class="btn pd-btn-cl" data-mov="saida">${ICON.menos}Saída</button>
        <button type="button" class="btn pd-btn-cl" data-mov="contagem">${ICON.check}Contagem</button>
      </div>
    </div>
    <section class="secao" aria-labelledby="pdHistT"><h3 id="pdHistT">Histórico</h3><div class="card pd-hist-card">${htmlHistorico(p)}</div></section>`;
}

function htmlForm(p) {
  const u = unid(p);
  return `<form class="card form pd-form" id="pdForm" novalidate>
    ${UI.campo({ id: 'pdNome', rotulo: 'Nome', valor: p.nome, attrs: 'autocomplete="off" maxlength="60"' })}
    <div class="campo"><span class="cat-rot" id="pdVendaRot">Vendido por</span>
      <div class="seg" role="radiogroup" aria-labelledby="pdVendaRot">
        <label><input type="radio" name="pdVenda" value="kg" ${p.venda !== 'un' ? 'checked' : ''}><span>Peso (kg)</span></label>
        <label><input type="radio" name="pdVenda" value="un" ${p.venda === 'un' ? 'checked' : ''}><span>Unidade</span></label>
      </div>
      <div class="aviso pd-aviso-un" id="pdAvisoUn" hidden>${ICON.alerta}<span></span></div>
    </div>
    <div class="form-2 pd-2">
      ${UI.campo({ id: 'pdPreco', rotulo: `Preço`, valor: D.paraInput(p.preco, 2), sufixo: `R$/${u}`, attrs: 'inputmode="decimal" autocomplete="off" placeholder="Definir"' })}
      ${UI.campo({ id: 'pdDesc', rotulo: 'Desconto do produto', valor: p.desconto ? D.paraInput(p.desconto, 1) : '', sufixo: '%', attrs: 'inputmode="decimal" autocomplete="off" placeholder="0"' })}
    </div>
    <div class="pd-final" id="pdFinal" aria-live="polite"></div>
    <div class="form-2 pd-2">
      <div id="pdPesoBox" ${u === 'un' ? 'hidden' : ''}>${UI.campo({ id: 'pdPeso', rotulo: 'Peso médio da peça', valor: D.paraInput(p.pesoMedio), sufixo: 'kg', attrs: 'inputmode="decimal" autocomplete="off" placeholder="Ex.: 1,5"' })}</div>
      ${UI.campo({ id: 'pdMin', rotulo: 'Estoque mínimo', dica: 'Avisa quando chegar nisso', valor: p.estoqueMin ? D.paraInput(p.estoqueMin) : '', sufixo: u, attrs: 'inputmode="decimal" autocomplete="off" placeholder="0"' })}
    </div>
    <p class="dica pd-dica" id="pdPesoDica" ${u === 'un' ? 'hidden' : ''}>O peso médio estima quantas peças há no estoque e o valor dos pedidos antes de pesar.</p>
    <div class="pd-sw">${UI.interruptor('pdAtivo', p.ativo, 'Disponível para venda')}</div>
    ${UI.campo({ id: 'pdObs', rotulo: 'Observação interna', valor: p.obs, tipo: 'textarea', dica: 'Só aparece aqui no app de gestão.', attrs: 'rows="3" maxlength="500"' })}
    <div class="pd-salvar"><span class="pd-sujo" id="pdSujo" aria-live="polite"></span><button type="submit" class="btn btn-1">${ICON.check}Salvar</button></div>
  </form>`;
}

TELAS.produto = {
  titulo: params => { const p = D.produto(params[0]); return p ? p.nome : 'Produto'; },
  nav: 'catalogo', voltar: '#/catalogo',
  render(params) {
    const p = D.produto(params[0]);
    if (!p) return UI.vazio('Produto não encontrado', 'Ele pode ter sido excluído.', '<a class="btn btn-1" href="#/catalogo">Ir para o catálogo</a>');
    return `<div class="cab pd-cab">
        <div class="pd-cab-id">${UI.miniatura(p, 72)}<div><h2>${esc(p.nome)}</h2>
          <div class="pd-cab-l">${htmlPreco(p, true)}${p.ativo ? '' : tagInativo}</div></div></div>
      </div>
      <div class="pd-grade">
        <div class="pd-col">
          <section aria-labelledby="pdDadosT"><h3 class="pd-h" id="pdDadosT">Dados e preço</h3>${htmlForm(p)}</section>
          <section class="secao" aria-labelledby="pdPromoT"><h3 id="pdPromoT">Promoções ativas</h3><div class="card">${htmlPromos(p)}</div></section>
        </div>
        <div class="pd-col" id="pdEstoque">${htmlEstoque(p)}</div>
      </div>
      <section class="secao pd-perigo" aria-labelledby="pdExclT"><h3 id="pdExclT" class="sr">Excluir</h3>
        <button type="button" class="btn btn-2 pd-excluir" data-excluir>${ICON.lixo}Excluir produto</button>
      </section>`;
  },
  montar(el, params) {
    const p = D.produto(params[0]); if (!p) return;
    const f = $('#pdForm', el);
    const vendaSel = () => $('input[name="pdVenda"]:checked', f).value;
    const atualizarFinal = () => {
      const u = vendaSel(), preco = D.num($('#pdPreco', f).value), dsc = D.num($('#pdDesc', f).value) || 0;
      const box = $('#pdFinal', f);
      if (preco === null || preco < 0 || dsc < 0 || dsc > 90) { box.innerHTML = preco === null && !$('#pdPreco', f).value.trim() ? '<span class="muted">Sem preço: aparece como “Definir preço”.</span>' : ''; return; }
      let pct = dsc, origem = dsc > 0 ? 'desconto do produto' : '';
      D.promocoesDo(p).forEach(pr => { if ((Number(pr.desconto) || 0) > pct) { pct = Number(pr.desconto); origem = `promoção “${pr.nome || 'sem nome'}”`; } });
      const ef = D.arred(preco * (1 - pct / 100));
      box.innerHTML = pct > 0
        ? `<span>Cliente paga</span> <b class="num">${esc(D.reais(ef))}</b><small>/${u}</small> <span class="pill tag-promo">−${esc(D.fmtNum(pct, 1))}%</span> <span class="muted">${esc(origem)}</span>`
        : `<span>Cliente paga</span> <b class="num">${esc(D.reais(preco))}</b><small>/${u}</small> <span class="muted">sem desconto</span>`;
    };
    const atualizarUnid = () => {
      const u = vendaSel();
      $('#pdPreco', f).nextElementSibling.textContent = `R$/${u}`;
      $('#pdMin', f).nextElementSibling.textContent = u;
      $('#pdPesoBox', f).hidden = u === 'un'; $('#pdPesoDica', f).hidden = u === 'un';
      const av = $('#pdAvisoUn', f);
      av.hidden = u === p.venda;
      $('span', av).textContent = u === p.venda ? '' : `Ao salvar, o estoque (${D.fmtNum(p.estoque || 0)}) passa a ser contado em ${u === 'un' ? 'unidades' : 'quilos'}. Faça uma contagem depois para acertar o valor.`;
      atualizarFinal();
    };
    const marcarSujo = () => { $('#pdSujo', f).textContent = 'Alterações não salvas'; };
    f.addEventListener('input', e => { if (e.target.id === 'pdPreco' || e.target.id === 'pdDesc') atualizarFinal(); marcarSujo(); });
    f.addEventListener('change', e => { if (e.target.name === 'pdVenda') atualizarUnid(); marcarSujo(); });
    atualizarUnid();

    f.addEventListener('submit', e => {
      e.preventDefault();
      limparErros(f);
      const nome = $('#pdNome', f).value.trim().replace(/\s+/g, ' ');
      const venda = vendaSel();
      const lerNum = (id, { vazio = null, min = 0, max = Infinity, msg }) => {
        const t = $('#' + id, f).value.trim();
        if (!t) return { v: vazio };
        const n = D.num(t);
        if (n === null || n < min || n > max) { erro(f, id, msg); return { erro: true }; }
        return { v: n };
      };
      let ok = true;
      if (!nome) { erro(f, 'pdNome', 'Informe o nome.'); ok = false; }
      else if (nomeRepetido(nome, p.id)) { erro(f, 'pdNome', 'Já existe outro produto com esse nome.'); ok = false; }
      const preco = lerNum('pdPreco', { min: 0, msg: 'Preço inválido: use um número maior ou igual a zero, ex.: 89,90' });
      const desc = lerNum('pdDesc', { vazio: 0, min: 0, max: 90, msg: 'Desconto deve ficar entre 0 e 90%.' });
      const peso = venda === 'kg' ? lerNum('pdPeso', { min: 0.001, msg: 'Peso médio inválido: use kg, ex.: 1,5' }) : { v: p.pesoMedio };
      const min = lerNum('pdMin', { vazio: 0, min: 0, msg: 'Valor inválido: use um número maior ou igual a zero.' });
      if (venda === 'un' && min.v && !Number.isInteger(min.v)) { erro(f, 'pdMin', 'Para venda por unidade, use um número inteiro.'); min.erro = true; }
      if (!ok || preco.erro || desc.erro || peso.erro || min.erro) { focarErro(f); UI.toast('Confira os campos destacados', 'erro'); return; }
      Object.assign(p, {
        nome, venda,
        preco: preco.v === null ? null : D.arred(preco.v),
        desconto: D.arred(desc.v, 1),
        pesoMedio: peso.v === null ? null : D.arred(peso.v, 3),
        estoqueMin: D.arred(min.v, 3),
        ativo: $('#pdAtivo', f).checked,
        obs: $('#pdObs', f).value.trim()
      });
      D.salvar();
      UI.toast('Produto salvo');
      App.redesenhar();
    });

    const est = $('#pdEstoque', el);
    est.addEventListener('click', async e => {
      const b = e.target.closest('[data-mov]');
      if (b) {
        const modo = b.dataset.mov;
        if (await dialogoEstoque(p.id, modo)) {
          est.innerHTML = htmlEstoque(p);   // só o bloco de estoque: não perde o que foi digitado no formulário
          const nb = $(`[data-mov="${modo}"]`, est); if (nb) nb.focus({ preventScroll: true });
        }
        return;
      }
      if (e.target.closest('[data-vermais]')) {
        histMostrar[p.id] = (histMostrar[p.id] || PASSO_HIST) + PASSO_HIST;
        $('.pd-hist-card', est).innerHTML = htmlHistorico(p);
      }
    });

    $('[data-excluir]', el).addEventListener('click', () => excluir(p));
  }
};

async function excluir(p) {
  const abertos = D.estado.pedidos.filter(o => ABERTOS.includes(o.status) && o.itens.some(i => i.prod === p.id));
  if (abertos.length) {
    const v = await UI.abrirDialogo({
      titulo: 'Não dá para excluir',
      html: `<div class="aviso aviso-erro">${ICON.alerta}<span><b>${esc(p.nome)}</b> está em ${abertos.length === 1 ? '1 pedido em aberto' : `${abertos.length} pedidos em aberto`}.</span></div>
        <ul class="pd-lista-ped">${abertos.slice(0, 6).map(o => `<li><a href="#/pedido/${encodeURIComponent(o.id)}" data-dlg-fechar>Pedido #${esc(o.num)} · ${esc(o.cliente || 'sem nome')}</a> ${UI.pillStatus(o.status)}</li>`).join('')}</ul>
        <p>Conclua ou cancele esses pedidos antes. Se só quer tirar o produto de venda, <b>desative</b> — ele some das vendas e o histórico continua.</p>`,
      botoes: [{ texto: 'Fechar', classe: 'btn-2', valor: null }, ...(p.ativo ? [{ texto: 'Desativar produto', classe: 'btn-1', valor: 'desativar' }] : [])]
    });
    if (v === 'desativar') { p.ativo = false; D.salvar(); UI.toast(`${p.nome} desativado`); App.redesenhar(); }
    return;
  }
  const antigos = D.estado.pedidos.filter(o => o.itens.some(i => i.prod === p.id)).length;
  const msg = `Excluir “${p.nome}” do catálogo? O histórico de estoque dele também será apagado.`
    + (antigos ? ` ${antigos === 1 ? '1 pedido antigo cita' : `${antigos} pedidos antigos citam`} este produto e ficará sem o nome dele. Se preferir, desative em vez de excluir.` : '');
  if (!await UI.confirmar(msg, { sim: 'Excluir', perigo: true })) return;
  const st = D.estado;
  st.produtos = st.produtos.filter(x => x.id !== p.id);
  st.movs = st.movs.filter(m => m.prod !== p.id);
  delete histMostrar[p.id];
  D.salvar();
  UI.toast(`${p.nome} excluído`);
  UI.ir('#/catalogo');
}

// para outros módulos (ex.: início) abrirem o ajuste rápido
window.Catalogo = { dialogoEstoque, novoProduto };
})();
