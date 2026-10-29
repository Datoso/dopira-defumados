/* =====================================================================
   Sistema Dopira · módulo Pedidos
   Telas: #/pedidos (lista agrupada por domingo) · #/pedido/ID (detalhe e edição)
   ===================================================================== */
(function () {
'use strict';
const { $, $$, esc, ICON } = UI;
window.TELAS = window.TELAS || {};

/* ---------- utilidades locais ---------- */
const CHAVE_FILTRO = 'dopira-pedidos-filtro';
const ABERTOS = ['novo', 'confirmado', 'pronto'];
const FILTROS = [
  { id: 'abertos',    nome: 'Abertos',     teste: p => ABERTOS.includes(p.status) },
  { id: 'novo',       nome: 'Novos',       teste: p => p.status === 'novo' },
  { id: 'confirmado', nome: 'Confirmados', teste: p => p.status === 'confirmado' },
  { id: 'pronto',     nome: 'Prontos',     teste: p => p.status === 'pronto' },
  { id: 'entregue',   nome: 'Entregues',   teste: p => p.status === 'entregue' },
  { id: 'cancelado',  nome: 'Cancelados',  teste: p => p.status === 'cancelado' },
  { id: 'todos',      nome: 'Todos',       teste: () => true }
];
let filtro = 'abertos';
try { const f = sessionStorage.getItem(CHAVE_FILTRO); if (f && FILTROS.some(x => x.id === f)) filtro = f; } catch (e) {}
let busca = '';

const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ORIGEM = { site: 'Site', manual: 'Manual', exemplo: 'Exemplo' };
const unidadeQtd = (prod, n) => prod && prod.venda === 'un' ? 'un' : (Number(n) === 1 ? 'peça' : 'peças');

function resumoItens(ped) {
  if (!ped.itens.length) return 'Sem itens';
  return ped.itens.map(it => { const pr = D.produto(it.prod); return `${D.fmtNum(it.qtd, 0)}x ${pr ? pr.nome : 'Produto removido'}`; }).join(', ');
}
/** Texto do total: "R$ 220,00", "≈ R$ 220,00" (peso estimado) ou parcial. */
function infoTotal(t) {
  const est = t.linhas.some(l => l.estimado);
  return { valor: t.total, completo: t.completo, estimado: est, vazio: !t.linhas.length };
}

/* =====================================================================
   LISTA
   ===================================================================== */
function contagens() {
  const c = {}; FILTROS.forEach(f => { c[f.id] = D.estado.pedidos.filter(f.teste).length; }); return c;
}
function filtrados() {
  const f = FILTROS.find(x => x.id === filtro) || FILTROS[0];
  const q = semAcento(busca.trim()).replace(/^#/, '');
  const qd = D.soDigitos(q);
  return D.estado.pedidos.filter(f.teste).filter(p => {
    if (!q) return true;
    if (semAcento(p.cliente).includes(q)) return true;
    if (qd && D.soDigitos(p.telefone).includes(qd)) return true;
    if (/^\d+$/.test(q) && String(p.num) === q) return true;
    return false;
  });
}
function grupos(lista) {
  const hoje = D.hojeISO();
  const mapa = new Map();
  lista.forEach(p => { const k = p.domingo || ''; if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(p); });
  const chaves = [...mapa.keys()];
  const futuros = chaves.filter(k => k && k >= hoje).sort();
  const passados = chaves.filter(k => k && k < hoje).sort().reverse();
  const ordem = [...futuros, ...passados, ...(mapa.has('') ? [''] : [])];
  return ordem.map(k => ({ dia: k, passado: !!k && k < hoje, pedidos: mapa.get(k).sort((a, b) => a.num - b.num) }));
}

function htmlLinha(p) {
  const t = D.totais(p), it = infoTotal(t);
  const total = it.vazio ? '<span class="muted">—</span>'
    : `<b class="num ped-valor">${it.estimado && it.completo ? '≈ ' : ''}${esc(D.reais(t.total))}</b>${!it.completo ? '<small class="ped-conf">a confirmar</small>' : ''}`;
  const tags = [
    `<span class="ped-modo">${esc(p.modo || 'Entrega')}</span>`,
    p.origem === 'site' ? '<span class="ped-tag ped-tag-site">Site</span>' : '',
    p.pagamento ? `<span class="ped-tag ped-tag-pg" title="Forma de pagamento">${esc(p.pagamento)}</span>` : '',
    p.pago ? '<span class="ped-tag ped-tag-pago">Pago</span>' : ''
  ].join('');
  return `<a class="linha ped-linha${p.status === 'cancelado' ? ' ped-cancelado' : ''}" href="#/pedido/${encodeURIComponent(p.id)}">
    <span class="ped-num num" aria-label="Pedido número ${p.num}">#${p.num}</span>
    <span class="meio">
      <b>${p.cliente ? esc(p.cliente) : '<i class="muted">Sem nome</i>'}</b>
      <span class="ped-itens">${esc(resumoItens(p))}</span>
      <span class="ped-tags">${tags}</span>
    </span>
    <span class="fim">
      <span class="ped-total">${total}</span>
      ${UI.pillStatus(p.status)}
    </span>
  </a>`;
}

function htmlGrupos() {
  const lista = filtrados();
  if (!lista.length) {
    if (!D.estado.pedidos.length) return UI.vazio('Nenhum pedido ainda',
      'Quando alguém encomendar pelo site neste aparelho, o pedido aparece aqui. Você também pode anotar um pedido do WhatsApp.',
      `<button type="button" class="btn btn-1" data-novo>${ICON.mais}Novo pedido</button>`);
    if (busca.trim()) return UI.vazio('Nada encontrado', `Nenhum pedido com “${busca.trim()}” neste filtro.`, '<button type="button" class="btn btn-2 btn-sm" data-limpar>Limpar busca</button>');
    const f = FILTROS.find(x => x.id === filtro);
    return UI.vazio(filtro === 'abertos' ? 'Tudo em dia' : `Nenhum pedido em “${f ? f.nome : ''}”`,
      filtro === 'abertos' ? 'Não há pedidos abertos agora.' : '', '<button type="button" class="btn btn-2 btn-sm" data-filtro="todos">Ver todos</button>');
  }
  const prox = D.proximoDomingo();
  return grupos(lista).map(g => {
    const validos = g.pedidos.filter(p => p.status !== 'cancelado');
    let soma = 0, incompleto = false;
    validos.forEach(p => { const t = D.totais(p); soma += t.total; if (!t.completo) incompleto = true; });
    const titulo = g.dia ? D.fmtData(g.dia, true) : 'Sem data';
    const marca = g.dia === prox ? '<span class="ped-dom-tag">este domingo</span>' : (g.passado ? '<span class="ped-dom-tag ped-dom-pass">já passou</span>' : '');
    const n = g.pedidos.length;
    return `<section class="ped-grupo" aria-label="${esc(titulo)}">
      <header class="ped-dom">
        <h3>${esc(titulo)}</h3>${marca}
        <span class="ped-dom-info">${n} ${n === 1 ? 'pedido' : 'pedidos'} · <b class="num">${esc(D.reais(D.arred(soma)))}</b>${incompleto ? ' <span class="ped-conf">+ a confirmar</span>' : ''}</span>
      </header>
      <div class="lista">${g.pedidos.map(htmlLinha).join('')}</div>
    </section>`;
  }).join('');
}

function htmlChips() {
  const c = contagens();
  return FILTROS.map(f => `<button type="button" class="chip" data-filtro="${f.id}" aria-pressed="${f.id === filtro}">${esc(f.nome)} <span class="n">${c[f.id]}</span></button>`).join('');
}

TELAS.pedidos = {
  titulo: 'Pedidos', nav: 'pedidos',
  render() {
    return `<div class="ped-lista-tela">
      <div class="cab">
        <div><h2>Pedidos</h2><p>Encomendas por domingo de entrega.</p></div>
        <button type="button" class="btn btn-1" data-novo>${ICON.mais}Novo pedido</button>
      </div>
      <div class="ped-busca campo">
        <label for="pedBusca" class="sr">Buscar pedido</label>
        <div class="campo-in">${ICON.busca}<input id="pedBusca" type="search" placeholder="Buscar por nome, telefone ou nº" value="${esc(busca)}" autocomplete="off" enterkeyhint="search"></div>
      </div>
      <div class="chips" role="group" aria-label="Filtrar por status" id="pedChips">${htmlChips()}</div>
      <div id="pedGrupos" aria-live="polite">${htmlGrupos()}</div>
      <div class="ped-importar">
        <p><b>Encomendas do site</b> feitas neste mesmo aparelho entram sozinhas. Se alguma não apareceu, traga agora.</p>
        <button type="button" class="btn btn-2 btn-sm" data-importar>${ICON.baixar}Importar do site</button>
      </div>
    </div>`;
  },
  montar(el) {
    const raiz = $('.ped-lista-tela', el);
    const atualizar = () => { $('#pedGrupos', raiz).innerHTML = htmlGrupos(); $('#pedChips', raiz).innerHTML = htmlChips(); };
    $('#pedBusca', raiz).addEventListener('input', e => { busca = e.target.value; $('#pedGrupos', raiz).innerHTML = htmlGrupos(); });
    raiz.addEventListener('click', e => {
      const fb = e.target.closest('[data-filtro]');
      if (fb) {
        filtro = fb.dataset.filtro;
        try { sessionStorage.setItem(CHAVE_FILTRO, filtro); } catch (er) {}
        atualizar();
        const ch = $(`.chip[data-filtro="${filtro}"]`, raiz); if (ch) { ch.focus({ preventScroll: true }); ch.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
        return;
      }
      if (e.target.closest('[data-novo]')) {
        const p = D.novoPedido(); D.salvar(); UI.ir('#/pedido/' + encodeURIComponent(p.id)); return;
      }
      if (e.target.closest('[data-limpar]')) { busca = ''; $('#pedBusca', raiz).value = ''; atualizar(); $('#pedBusca', raiz).focus(); return; }
      if (e.target.closest('[data-importar]')) {
        let n = 0; try { n = D.importarDoSite(); } catch (er) { n = 0; }
        UI.toast(n ? (n === 1 ? '1 encomenda importada do site' : `${n} encomendas importadas do site`) : 'Nenhuma encomenda nova do site');
        if (n) atualizar();
      }
    });
  }
};

/* =====================================================================
   DETALHE
   ===================================================================== */
const FLUXO = ['novo', 'confirmado', 'pronto', 'entregue'];
const ACAO = { novo: 'Confirmar pedido', confirmado: 'Marcar como pronto', pronto: 'Marcar como entregue' };

/** Pedido já deu baixa: mantém o estoque igual ao que os itens pedem agora (diferença por item). */
function sincronizarEstoque(ped) {
  if (!ped.baixado) return;
  ped.itens.forEach(it => {
    const q = D.quantidadeEstoque(it);
    if (q === null) { if (!(it.baixa > 0)) it.semBaixa = true; return; }   // sem peso: mantém o que já saiu
    const delta = D.arred(q - (it.baixa || 0), 3);
    if (delta) { D.ajustarEstoque(it.prod, -delta, `Pedido #${ped.num} alterado`, ped.id); it.baixa = q; }
    it.semBaixa = false;
  });
}
/* Digitação salva com atraso (só os dados). O estoque só é acertado em salvarJa():
   no change/blur do campo, em cliques (+/−, remover, status) e ao sair da tela —
   assim digitar "2,4" devagar não gera movimentos intermediários no histórico. */
let timer = null, pendente = null, sujo = null, pedAberto = null;
function salvarJa(ped) {
  clearTimeout(timer); timer = null; pendente = null; sujo = null;
  sincronizarEstoque(ped); D.salvar();
}
function agendar(ped) {
  pendente = ped; sujo = ped; clearTimeout(timer);
  timer = setTimeout(() => { timer = null; pendente = null; D.salvar(); }, 400);
}
/** Pedido "Novo pedido" que ficou sem nada preenchido: não deve sobrar na lista nem no badge. */
const vazio = p => p.status === 'novo' && p.origem === 'manual' && !String(p.cliente || '').trim()
  && !D.soDigitos(p.telefone) && !p.itens.length;
function aoSair(paraHash) {
  const ped = pendente || sujo; if (ped) salvarJa(ped);
  const id = pedAberto; if (!id) return;
  if (paraHash !== undefined && paraHash === '#/pedido/' + encodeURIComponent(id)) return;   // continua no mesmo pedido
  pedAberto = null;
  const p = D.pedido(id);
  if (p && vazio(p)) { const i = D.estado.pedidos.indexOf(p); if (i >= 0) { D.estado.pedidos.splice(i, 1); D.salvar(); } }
}
window.addEventListener('hashchange', () => aoSair(location.hash));
window.addEventListener('pagehide', () => aoSair());
// voltou do cache do navegador depois de um pagehide que descartou o pedido vazio: redesenha
window.addEventListener('pageshow', e => { if (e.persisted && /^#\/pedido\//.test(location.hash)) App.redesenhar(); });

/** Venda por unidade com peso aproximado: peso total aproximado do item (kg) ou null. */
const pesoAproxItem = (prod, qtd) => prod && prod.venda === 'un' && prod.pesoAprox > 0 ? D.arred((Number(qtd) || 0) * prod.pesoAprox, 3) : null;
/* ---------- preço por item (só deste pedido) ----------
   it.preco + sem it.precoAuto = preço digitado à mão neste pedido.
   it.preco + it.precoAuto   = preço congelado na confirmação (dados.js). */
const temPrecoManual = it => it.preco !== undefined && it.preco !== null && !it.precoAuto;
const precoCatalogo = (prod, ped) => prod ? D.precoNoPedido(prod, ped) : null;
function precoAlterado(l, ped) {
  if (!temPrecoManual(l.item)) return false;
  const cat = precoCatalogo(l.prod, ped);
  return cat === null || D.arred(cat) !== D.arred(l.preco);
}
function conteudoPreco(l, ped) {
  const prod = l.prod, un = esc(D.rotuloVenda(prod));
  if (temPrecoManual(l.item)) {
    const cat = precoCatalogo(prod, ped);
    if (!precoAlterado(l, ped)) return `<span class="num">${esc(D.reais(l.preco))}${un}</span>`;
    return `${cat !== null ? `<s class="muted">${esc(D.reais(cat))}</s> ` : ''}<span class="num">${esc(D.reais(l.preco))}${un}</span> <span class="pill ped-tag-alt">preço alterado</span>`;
  }
  if (l.item.preco !== undefined && l.item.preco !== null) return `<span class="num">${esc(D.reais(l.preco))}${un}</span> <small class="muted">preço da confirmação</small>`;
  const d = D.descontoDo(prod, D.diaDoPedido(ped));
  if (d.pct > 0 && prod.preco !== null) {
    const rot = d.origem === 'promocao' ? `promo −${D.fmtNum(d.pct, 1)}%` : `−${D.fmtNum(d.pct, 1)}%`;
    return `<s class="muted">${esc(D.reais(prod.preco))}</s> <span class="num">${esc(D.reais(l.preco))}${un}</span> <span class="pill tag-promo">${esc(rot)}</span>`;
  }
  return `<span class="num">${esc(D.reais(l.preco))}${un}</span>`;
}
function textoPreco(l, ped, i) {
  const prod = l.prod; if (!prod) return '<span class="muted">Produto removido</span>';
  const nome = esc(prod.nome);
  if (l.preco === null) return `<a class="ped-falta" href="#/produto/${encodeURIComponent(prod.id)}">Definir preço</a>
    <button type="button" class="ped-preco-btn ped-preco-so" data-edpreco="${i}" aria-expanded="false">ou só neste pedido${ICON.editar}</button>`;
  return `<button type="button" class="ped-preco-btn" data-edpreco="${i}" aria-expanded="false" aria-label="Preço de ${nome}: ${esc(D.reais(l.preco))}. Toque para alterar só neste pedido">${conteudoPreco(l, ped)}${ICON.editar}</button>`;
}
function htmlEditorPreco(ped, l, i) {
  const prod = l.prod, it = l.item, suf = D.rotuloVenda(prod);
  const cat = precoCatalogo(prod, ped);
  return `<div class="ped-preco-ed" data-preco-ed="${i}" hidden>
    <div class="campo">
      <label for="pdPr${i}">Preço neste pedido</label>
      <div class="campo-in"><span class="pre" aria-hidden="true">R$</span><input id="pdPr${i}" data-preco="${i}" inputmode="decimal" autocomplete="off" value="${esc(l.preco !== null ? D.paraInput(l.preco, 2) : '')}" placeholder="0,00" style="padding-right:${Math.min(160, 18 + suf.length * 8)}px" aria-describedby="pdPrD${i}"><span class="suf">${esc(suf)}</span></div>
      <small class="dica" id="pdPrD${i}">${cat !== null ? `Catálogo: ${esc(D.reais(cat))}${esc(suf)}. ` : 'Sem preço no catálogo. '}Muda só este pedido.</small>
    </div>
    <div class="ped-preco-ed-acoes">
      <button type="button" class="btn btn-3 btn-sm" data-prok="${i}">Pronto</button>
      <button type="button" class="btn-link ped-preco-volta" data-prvolta="${i}" ${temPrecoManual(it) ? '' : 'hidden'}>Voltar ao preço do catálogo</button>
    </div>
  </div>`;
}
function textoValor(l) {
  if (l.valor !== null) return `<b class="num">${l.estimado ? '≈ ' : ''}${esc(D.reais(l.valor))}</b>`;
  return '<span class="ped-conf">a confirmar</span>';
}
function textoEstimativa(l) {
  const prod = l.prod;
  const pa = pesoAproxItem(prod, l.item.qtd);
  if (pa !== null) return `≈ ${D.fmtPeso(pa)}${(Number(l.item.qtd) || 0) > 1 ? ` (≈${D.fmtPeso(prod.pesoAprox)} cada)` : ''}`;
  if (!prod || prod.venda !== 'kg') return '';
  if (l.item.peso > 0) return '';
  if (l.estimado) return `≈ ${D.fmtNum(l.base)} kg estimado (${D.fmtNum(prod.pesoMedio)} kg/peça)`;
  return 'Sem peso médio no produto: informe o peso';
}

function htmlItem(ped, l, i) {
  const prod = l.prod, it = l.item, kg = !prod || prod.venda === 'kg';
  return `<li class="ped-item" data-i="${i}">
    <div class="ped-item-topo">
      ${UI.miniatura(prod, 48)}
      <div class="ped-item-nome">
        <b>${prod ? esc(prod.nome) : 'Produto removido'}</b>
        <span class="ped-item-preco" data-precotxt="${i}">${textoPreco(l, ped, i)}</span>
      </div>
      <button type="button" class="btn-ic ped-rm" data-rm="${i}" aria-label="Remover ${esc(prod ? prod.nome : 'item')}">${ICON.lixo}</button>
    </div>
    ${prod ? htmlEditorPreco(ped, l, i) : ''}
    <div class="ped-item-campos">
      <div class="ped-q">
        <span class="ped-rot" id="pdQr${i}">${prod && prod.venda === 'un' ? 'Unidades' : 'Peças'}</span>
        <div class="passo" role="group" aria-labelledby="pdQr${i}">
          <button type="button" data-menos="${i}" aria-label="Diminuir">${ICON.menos}</button>
          <input id="pdQ${i}" data-qtd="${i}" inputmode="numeric" value="${esc(D.fmtNum(it.qtd, 0))}" aria-labelledby="pdQr${i}">
          <button type="button" data-mais="${i}" aria-label="Aumentar">${ICON.mais}</button>
        </div>
      </div>
      ${kg && prod ? `<div class="campo ped-peso">
        <label for="pdP${i}">Peso real (kg)</label>
        <div class="campo-in"><input id="pdP${i}" data-peso="${i}" inputmode="decimal" placeholder="opcional" value="${esc(it.peso > 0 ? D.paraInput(it.peso) : '')}"><span class="suf">kg</span></div>
        <small class="dica" data-est="${i}">${esc(textoEstimativa(l))}</small>
      </div>` : ''}
      ${pesoAproxItem(prod, it.qtd) !== null ? `<div class="ped-aprox"><span class="ped-rot">Peso aprox.</span><span class="ped-aprox-v num" data-est="${i}">${esc(textoEstimativa(l))}</span></div>` : ''}
      <div class="ped-item-valor" data-valor="${i}">${textoValor(l)}</div>
    </div>
    <p class="ped-item-aviso" data-aviso="${i}" ${ped.baixado && it.semBaixa ? '' : 'hidden'}>${ICON.alerta}Ainda sem baixa no estoque: informe o peso real.</p>
  </li>`;
}
function htmlItens(ped, t) {
  if (!ped.itens.length) return `<div class="ped-sem-itens"><p>Nenhum item ainda.</p></div>`;
  return `<ul class="ped-itens-lista">${t.linhas.map((l, i) => htmlItem(ped, l, i)).join('')}</ul>`;
}

function htmlFaltas(t) {
  const f = [];
  t.linhas.forEach(l => {
    if (!l.prod) return;
    const link = `<a href="#/produto/${encodeURIComponent(l.prod.id)}">${esc(l.prod.nome)}</a>`;
    if (l.semPreco) f.push(`${link}: falta definir o preço`);
    else if (l.semPeso) f.push(`${esc(l.prod.nome)}: informe o peso real (ou o peso médio em ${link})`);
  });
  return f;
}
function htmlResumo(ped, t) {
  const cupomTxt = t.cupom.ok ? `Cupom ${esc(t.cupom.cupom.codigo)}` : 'Cupom';
  const est = t.linhas.some(l => l.estimado);
  const faltas = htmlFaltas(t);
  return `<dl class="ped-contas">
      <div><dt>Subtotal</dt><dd class="num">${esc(D.reais(t.subtotal))}</dd></div>
      ${t.cupom.ok ? `<div class="ped-desc"><dt>${cupomTxt}</dt><dd class="num">−${esc(D.reais(t.desconto))}</dd></div>` : ''}
      ${t.taxa ? `<div><dt>Taxa de entrega</dt><dd class="num">${esc(D.reais(t.taxa))}</dd></div>` : ''}
      <div class="ped-total-g"><dt>Total${!t.completo ? ' parcial' : ''}</dt><dd class="num">${est && t.completo ? '≈ ' : ''}${esc(D.reais(t.total))}</dd></div>
    </dl>
    ${est && t.completo ? '<p class="ped-nota">≈ usa o peso médio; o valor final sai na pesagem.</p>' : ''}
    ${!t.completo && t.linhas.length ? `<div class="aviso ped-faltas">${ICON.alerta}<div><b>Faltam preços ou pesos: total parcial.</b><ul>${faltas.map(x => `<li>${x}</li>`).join('')}</ul></div></div>` : ''}`;
}
function htmlCupomRes(t) {
  if (!t.cupom.cupom && !t.cupom.motivo) return '';
  if (t.cupom.ok) return `<span class="ped-cupom-ok">${ICON.check}Cupom aplicado: −${esc(D.reais(t.desconto))}</span>`;
  return `<span class="ped-cupom-erro">${esc(t.cupom.motivo)}</span>`;
}

function htmlStatus(ped) {
  if (ped.status === 'cancelado') {
    return `<div class="ped-status card ped-status-canc">
      <div class="ped-status-txt">${ICON.x}<span><b>Pedido cancelado.</b> Os itens não estão reservados no estoque.</span></div>
      <button type="button" class="btn btn-2 btn-sm" id="pdReabrir" data-st="novo">Reabrir pedido</button>
    </div>`;
  }
  const atual = FLUXO.indexOf(ped.status);
  const passos = FLUXO.map((s, i) => `<li><button type="button" id="pdSt-${s}" class="ped-passo${i < atual ? ' feito' : ''}${i === atual ? ' atual' : ''}" data-st="${s}" ${i === atual ? 'aria-current="step"' : ''}>
      <span class="ped-bola">${i < atual ? ICON.check : i + 1}</span><span>${esc(D.nomeStatus(s))}</span></button></li>`).join('');
  const prox = FLUXO[atual + 1];
  return `<div class="ped-status card">
    <ol class="ped-fluxo" aria-label="Andamento do pedido">${passos}</ol>
    <div class="ped-status-acoes">
      ${prox ? `<button type="button" class="btn btn-3" id="pdAcao" data-st="${prox}">${ICON.check}${esc(ACAO[ped.status])}</button>` : `<p class="ped-fim">${ICON.check}Pedido entregue${ped.pago ? ' e pago' : ''}.</p>`}
      <button type="button" class="btn-link ped-canc" id="pdCancelar" data-cancelar>Cancelar pedido</button>
    </div>
    <p class="ped-nota">${ped.baixado ? 'Os itens já saíram do estoque. Cancelar devolve; mudar itens ou pesos acerta o estoque na hora.' : 'Ao confirmar, os itens saem do estoque. Cancelar devolve.'}</p>
  </div>`;
}

/* ---------- pagamento ---------- */
const FORMAS = D.PAGAMENTOS.filter(Boolean);   // Pix · Dinheiro · Cartão
const troco = (ped, t) => ped.pagamento === 'Dinheiro' && ped.trocoPara > 0 ? D.arred(ped.trocoPara - t.total) : null;
/** "Pix", "dinheiro (troco para R$ 250,00)", "cartão na maquininha, na entrega" ou '' */
function textoPagamento(ped, t, cliente) {
  if (ped.pagamento === 'Pix') return 'Pix';
  if (ped.pagamento === 'Dinheiro') {
    const tr = troco(ped, t);
    return `dinheiro${tr !== null && tr > 0 ? ` (troco para ${D.reais(ped.trocoPara)}${cliente ? '' : `: levar ${D.reais(tr)}`})` : tr === 0 ? ' (sem troco)' : ''}`;
  }
  if (ped.pagamento === 'Cartão') return `cartão, na maquininha na ${ped.modo === 'Retirada' ? 'retirada' : 'entrega'}`;
  return '';
}
function htmlTroco(ped, t) {
  const tr = troco(ped, t);
  if (tr === null) return t.total > 0 ? `<span class="muted">Deixe vazio se o cliente não precisa de troco.</span>` : '';
  const ap = !t.completo || t.linhas.some(l => l.estimado) ? ' <span class="muted">(total ainda aproximado)</span>' : '';
  if (tr < 0) return `<span class="ped-troco-erro">${ICON.alerta}${esc(D.reais(ped.trocoPara))} é menos que o total de ${esc(D.reais(t.total))}.</span>`;
  if (tr === 0) return `<span class="ped-troco-ok">Valor certo, sem troco.${ap}</span>`;
  return `<span class="ped-troco-ok">Levar troco de <b class="num">${esc(D.reais(tr))}</b>${ap}</span>`;
}
function msgPix(ped, px) {
  const nome = (ped.cliente || '').trim().split(/\s+/)[0];
  return `Olá${nome ? ', ' + nome : ''}! Segue o Pix da sua encomenda #${ped.num} na Dopira Defumados.\n`
    + `Total${px.parcial ? ' aproximado' : ''}: ${D.reais(px.valor)}\n\nPix copia e cola:\n${px.codigo}\n\n`
    + 'É só copiar o código acima e colar no app do seu banco, na opção Pix copia e cola. Obrigado!';
}
function htmlPix(ped) {
  if (!Pix.pronto()) return `<div class="aviso ped-pix-sem">${ICON.alerta}<div><b>Cadastre sua chave Pix em Ajustes</b> para gerar o código de cada pedido.
    <a class="btn btn-2 btn-sm" href="#/ajustes">Abrir Ajustes</a></div></div>`;
  let px = null; try { px = Pix.doPedido(ped); } catch (e) { px = null; }
  if (!px) return `<p class="ped-pix-vazio">O código Pix aparece aqui quando o pedido tiver itens com preço.</p>`;
  const zap = UI.linkZap(ped.telefone, msgPix(ped, px));
  return `<div class="ped-pix-cx">
    ${px.parcial ? `<p class="aviso ped-pix-parc">${ICON.alerta}<span>O valor ainda é aproximado (faltam pesos ou preços). Gere depois de pesar.</span></p>` : ''}
    <div class="ped-pix-qr">${Pix.qrSVG(px.codigo, 196)}</div>
    <div class="ped-pix-info">
      <span class="ped-pix-valor num">${esc(D.reais(px.valor))}</span>
      <span class="ped-pix-id">Identificador <b>${esc(px.txid)}</b></span>
    </div>
    <div class="campo ped-pix-cod">
      <label for="pdPixCod">Pix copia e cola</label>
      <textarea id="pdPixCod" readonly rows="4" spellcheck="false">${esc(px.codigo)}</textarea>
    </div>
    <button type="button" class="btn btn-1" data-pix-copiar>${ICON.copiar}Copiar código Pix</button>
    <a class="btn btn-zap" id="pdPixZap" ${zap ? `href="${esc(zap)}"` : 'aria-disabled="true"'} target="_blank" rel="noopener">${ICON.zap}Enviar Pix no WhatsApp</a>
    <p class="ped-nota">O dinheiro cai direto na sua conta. Confira no app do banco e marque <b>Pago</b>.</p>
  </div>`;
}
function htmlPagamento(ped, t) {
  const pg = ped.pagamento;
  return `<div class="ped-pg">
    <span class="ped-rot" id="pdPgR">Pagamento</span>
    <div class="seg ped-pg-seg" role="radiogroup" aria-labelledby="pdPgR">
      ${FORMAS.map(f => `<label><input type="radio" name="pdPg" value="${esc(f)}" ${pg === f ? 'checked' : ''}><span>${esc(f)}</span></label>`).join('')}
    </div>
    <p class="dica ped-pg-nada" id="pdPgNada" ${pg ? 'hidden' : ''}>Ainda não definido. Escolha como o cliente vai pagar.</p>
    <div class="campo ped-pg-din" id="pdPgDin" ${pg === 'Dinheiro' ? '' : 'hidden'}>
      <label for="pdTroco">Troco para (R$)</label>
      <div class="campo-in"><input id="pdTroco" data-troco inputmode="decimal" autocomplete="off" placeholder="opcional" value="${esc(ped.trocoPara > 0 ? D.paraInput(ped.trocoPara, 2) : '')}"><span class="suf">R$</span></div>
      <small class="dica ped-troco" id="pdTrocoRes" aria-live="polite">${htmlTroco(ped, t)}</small>
    </div>
    <p class="dica ped-pg-cartao" id="pdPgCartao" ${pg === 'Cartão' ? '' : 'hidden'}>Cobrar na ${ped.modo === 'Retirada' ? 'retirada' : 'entrega'}, na maquininha.</p>
    <div class="ped-pix" id="pdPix" ${pg === 'Pix' ? '' : 'hidden'}>${pg === 'Pix' ? htmlPix(ped) : ''}</div>
  </div>`;
}

function msgZap(ped, t) {
  const nome = (ped.cliente || '').trim().split(/\s+/)[0];
  const itens = t.linhas.map(l => {
    const pr = l.prod, n = pr ? pr.nome : 'Produto';
    const q = Number(l.item.qtd) || 0;
    let s = pr && pr.venda === 'un'
      ? (pr.pesoAprox > 0 ? `• ${D.fmtNum(q, 0)} ${q === 1 ? 'unidade' : 'unidades'} de ${n} (≈${D.fmtPeso(pr.pesoAprox)} cada)` : `• ${D.fmtNum(q, 0)} ${n}`)
      : `• ${D.fmtNum(q, 0)} ${unidadeQtd(pr, q)} de ${n}`;
    if (pr && pr.venda === 'kg') {
      if (l.item.peso > 0) s += ` (${D.fmtNum(l.item.peso)} kg)`;
      else if (l.estimado) s += ` (aprox. ${D.fmtNum(l.base)} kg)`;
    }
    if (l.valor !== null) s += ` – ${l.estimado ? 'aprox. ' : ''}${D.reais(l.valor)}`;
    return s;
  }).join('\n');
  const dia = ped.domingo ? D.fmtData(ped.domingo, true) : 'domingo (a combinar)';
  const quando = ped.modo === 'Retirada'
    ? `Retirada no ${dia}.`
    : `Entrega no ${dia}${ped.endereco ? `, em ${ped.endereco.trim()}` : ''}.`;
  const est = t.linhas.some(l => l.estimado);
  const linhas = [];
  if (t.cupom.ok) linhas.push(`Cupom ${t.cupom.cupom.codigo}: −${D.reais(t.desconto)}`);
  if (t.taxa) linhas.push(`Taxa de entrega: ${D.reais(t.taxa)}`);
  if (!t.completo || !t.linhas.length) linhas.push('Total: valor a confirmar (as peças são pesadas antes da entrega)');
  else if (est) linhas.push(`Total aproximado: ${D.reais(t.total)} (o valor final sai na pesagem)`);
  else linhas.push(`Total: ${D.reais(t.total)}`);
  const pg = textoPagamento(ped, t, true);
  if (pg) linhas.push(`Pagamento: ${pg}${ped.pago ? ' (já recebido, obrigado!)' : ''}`);
  const abre = ped.status === 'pronto' ? `sua encomenda #${ped.num} está pronta!`
    : ped.status === 'entregue' ? `obrigado pela encomenda #${ped.num}!`
    : `confirmando sua encomenda #${ped.num}:`;
  return `Olá${nome ? ', ' + nome : ''}! Aqui é da Dopira Defumados, ${abre}\n\n${itens || '(itens a combinar)'}\n\n${quando}\n${linhas.join('\n')}\n\nQualquer dúvida é só chamar por aqui. Obrigado pela preferência!\nDopira Defumados`;
}
function textoResumo(ped, t) {
  const it = t.linhas.map(l => {
    const pr = l.prod;
    let s = `- ${D.fmtNum(l.item.qtd, 0)}x ${pr ? pr.nome : 'Produto removido'}`;
    if (pr && pr.venda === 'kg') s += l.item.peso > 0 ? ` · ${D.fmtNum(l.item.peso)} kg` : (l.estimado ? ` · ≈${D.fmtNum(l.base)} kg` : ' · sem peso');
    else if (pesoAproxItem(pr, l.item.qtd) !== null) s += ` · ≈${D.fmtPeso(pesoAproxItem(pr, l.item.qtd))} (≈${D.fmtPeso(pr.pesoAprox)} cada)`;
    if (precoAlterado(l, ped)) s += ` · preço alterado: ${D.reais(l.preco)}${D.rotuloVenda(pr)}`;
    s += ` · ${l.valor !== null ? D.reais(l.valor) : 'a confirmar'}`;
    return s;
  });
  const est = t.linhas.some(l => l.estimado);
  const cab = [
    `Pedido #${ped.num} · ${D.nomeStatus(ped.status)}${ped.pago ? ' · pago' : ''}`,
    `Cliente: ${ped.cliente || '—'}${ped.telefone ? ' · ' + ped.telefone : ''}`,
    `${ped.modo || 'Entrega'}: ${ped.domingo ? D.fmtData(ped.domingo, true) : '—'}`,
    ped.modo !== 'Retirada' && ped.endereco ? `Endereço: ${ped.endereco}${ped.referencia ? ' (' + ped.referencia + ')' : ''}` : '',
    ped.obs ? `Obs.: ${ped.obs}` : ''
  ].filter(Boolean);
  const contas = [
    `Subtotal: ${D.reais(t.subtotal)}`,
    t.cupom.ok ? `Cupom ${t.cupom.cupom.codigo}: −${D.reais(t.desconto)}` : '',
    t.taxa ? `Taxa de entrega: ${D.reais(t.taxa)}` : '',
    `Total${!t.completo ? ' parcial' : ''}: ${est && t.completo ? '≈ ' : ''}${D.reais(t.total)}${!t.completo ? ' (a confirmar)' : ''}`,
    `Pagamento: ${textoPagamento(ped, t) || 'a definir'}${ped.pago ? ' · pago' : ''}`
  ].filter(Boolean);
  return [cab.join('\n'), (it.length ? it : ['(sem itens)']).join('\n'), contas.join('\n')].join('\n\n');
}

TELAS.pedido = {
  titulo: params => { const p = D.pedido(params[0]); return p ? `Pedido #${p.num}` : 'Pedido'; },
  nav: 'pedidos', voltar: '#/pedidos',
  render(params) {
    const ped = D.pedido(params[0]);
    if (!ped) return UI.vazio('Pedido não encontrado', 'Ele pode ter sido excluído.', '<a class="btn btn-1" href="#/pedidos">Ver pedidos</a>');
    const t = D.totais(ped);
    const ent = ped.modo !== 'Retirada';
    const zap = UI.linkZap(ped.telefone, msgZap(ped, t));
    return `<div class="ped-det" data-id="${esc(ped.id)}">
      <div class="cab ped-cab">
        <div>
          <h2>Pedido <span class="num">#${ped.num}</span></h2>
          <p class="ped-meta">${UI.pillStatus(ped.status)}<span>${esc(ORIGEM[ped.origem] || 'Manual')}</span><span>Criado em ${esc(D.fmtDataHora(ped.criado))}</span></p>
        </div>
      </div>
      <div id="pdStatus" tabindex="-1" aria-label="Status do pedido">${htmlStatus(ped)}</div>

      <div class="ped-grade">
        <div class="ped-col">
          <section class="card ped-bloco" aria-labelledby="pdTitCli">
            <h3 id="pdTitCli">Cliente e entrega</h3>
            <div class="form">
              <div class="form-2 ped-f2">
                ${UI.campo({ id: 'pdCliente', rotulo: 'Nome', valor: ped.cliente, attrs: 'data-k="cliente" autocomplete="off"' })}
                ${UI.campo({ id: 'pdTel', rotulo: 'Telefone / WhatsApp', valor: ped.telefone, tipo: 'tel', attrs: 'data-k="telefone" inputmode="tel" autocomplete="off" placeholder="(18) 9…"' })}
              </div>
              <div class="form-2 ped-f2">
                ${UI.campo({ id: 'pdDomingo', rotulo: 'Domingo de entrega', valor: ped.domingo, tipo: 'date', attrs: 'data-k="domingo"' })}
                <div class="campo"><span class="ped-rot" id="pdModoR">Como recebe</span>
                  <div class="seg" role="radiogroup" aria-labelledby="pdModoR">
                    <label><input type="radio" name="pdModo" value="Entrega" ${ent ? 'checked' : ''}><span>Entrega</span></label>
                    <label><input type="radio" name="pdModo" value="Retirada" ${!ent ? 'checked' : ''}><span>Retirada</span></label>
                  </div>
                </div>
              </div>
              <p class="ped-aviso-dom" id="pdDomAviso" ${ped.domingo && D.dataDeISO(ped.domingo).getDay() !== 0 ? '' : 'hidden'}>${ICON.alerta}Essa data não é um domingo.</p>
              <div class="ped-entrega form" id="pdEntrega" ${ent ? '' : 'hidden'}>
                ${UI.campo({ id: 'pdEnd', rotulo: 'Endereço', valor: ped.endereco, attrs: 'data-k="endereco" autocomplete="off"' })}
                ${UI.campo({ id: 'pdRef', rotulo: 'Referência', valor: ped.referencia, attrs: 'data-k="referencia" autocomplete="off"' })}
              </div>
              ${UI.campo({ id: 'pdObs', rotulo: 'Observação', valor: ped.obs, tipo: 'textarea', attrs: 'data-k="obs" rows="2"' })}
            </div>
            <p class="ped-salvo" aria-live="polite" id="pdSalvo">Salva sozinho enquanto você digita.</p>
          </section>

          <section class="card ped-bloco" aria-labelledby="pdTitItens">
            <h3 id="pdTitItens">Itens</h3>
            <div id="pdItens">${htmlItens(ped, t)}</div>
            <button type="button" class="btn btn-2 ped-add" data-add>${ICON.mais}Adicionar produto</button>
          </section>
        </div>

        <aside class="ped-col ped-lado">
          <section class="card ped-bloco ped-resumo" aria-labelledby="pdTitRes">
            <h3 id="pdTitRes">Resumo</h3>
            <div class="form ped-ajustes">
              <div class="campo">
                <label for="pdCupom">Cupom</label>
                <div class="campo-in"><input id="pdCupom" data-k="cupom" value="${esc(ped.cupom)}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Código"></div>
                <small class="ped-cupom-res" id="pdCupomRes" aria-live="polite">${htmlCupomRes(t)}</small>
              </div>
              <div class="campo" id="pdTaxaCampo" ${ent ? '' : 'hidden'}>
                <label for="pdTaxa">Taxa de entrega</label>
                <div class="campo-in"><input id="pdTaxa" data-k="taxa" inputmode="decimal" value="${esc(ped.taxa ? D.paraInput(ped.taxa, 2) : '')}" placeholder="0,00"><span class="suf">R$</span></div>
              </div>
            </div>
            <div id="pdResumo">${htmlResumo(ped, t)}</div>
            ${htmlPagamento(ped, t)}
            <div class="ped-pago">${UI.interruptor('pdPago', ped.pago, 'Pago')}</div>
          </section>
          <section class="ped-acoes" aria-label="Ações">
            <a class="btn btn-zap" id="pdZap" ${zap ? `href="${esc(zap)}"` : 'aria-disabled="true"'} target="_blank" rel="noopener">${ICON.zap}WhatsApp do cliente</a>
            <small class="dica ped-zap-dica" id="pdZapDica" ${zap ? 'hidden' : ''}>Informe o telefone para mandar a mensagem.</small>
            <button type="button" class="btn btn-2" data-copiar>${ICON.copiar}Copiar resumo</button>
            <button type="button" class="btn-link ped-excluir" data-excluir>${ICON.lixo}Excluir pedido</button>
          </section>
        </aside>
      </div>
    </div>`;
  },
  montar(el, params) {
    const ped = D.pedido(params[0]); if (!ped) return;
    const raiz = $('.ped-det', el);
    pedAberto = ped.id;

    const atualizar = () => {
      const t = D.totais(ped);
      t.linhas.forEach((l, i) => {
        const v = $(`[data-valor="${i}"]`, raiz); if (v) v.innerHTML = textoValor(l);
        const e = $(`[data-est="${i}"]`, raiz); if (e) e.textContent = textoEstimativa(l);
        const av = $(`[data-aviso="${i}"]`, raiz); if (av) av.hidden = !(ped.baixado && l.item.semBaixa);
      });
      $('#pdResumo', raiz).innerHTML = htmlResumo(ped, t);
      $('#pdCupomRes', raiz).innerHTML = htmlCupomRes(t);
      const zap = UI.linkZap(ped.telefone, msgZap(ped, t)), a = $('#pdZap', raiz);
      if (zap) { a.href = zap; a.removeAttribute('aria-disabled'); } else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
      $('#pdZapDica', raiz).hidden = !!zap;
      atualizarPg(t);
    };
    /* pagamento: só troca o que mudou (o QR é refeito quando o código muda) */
    let pixChave = null;
    const atualizarPg = (t = D.totais(ped)) => {
      const pg = ped.pagamento;
      $('#pdPgNada', raiz).hidden = !!pg;
      $('#pdPgDin', raiz).hidden = pg !== 'Dinheiro';
      $('#pdPgCartao', raiz).hidden = pg !== 'Cartão';
      $('#pdPgCartao', raiz).textContent = `Cobrar na ${ped.modo === 'Retirada' ? 'retirada' : 'entrega'}, na maquininha.`;
      if (pg === 'Dinheiro') $('#pdTrocoRes', raiz).innerHTML = htmlTroco(ped, t);
      const box = $('#pdPix', raiz);
      box.hidden = pg !== 'Pix';
      if (pg !== 'Pix') { if (pixChave !== null) { box.innerHTML = ''; pixChave = null; } return; }
      let px = null; try { px = Pix.doPedido(ped); } catch (e) { px = null; }
      const chave = !Pix.pronto() ? 'sem-config' : px ? px.codigo + (px.parcial ? '|p' : '') : 'sem-valor';
      if (chave !== pixChave) { box.innerHTML = htmlPix(ped); pixChave = chave; }
      const a = $('#pdPixZap', box);
      if (a && px) {
        const z = UI.linkZap(ped.telefone, msgPix(ped, px));
        if (z) { a.href = z; a.removeAttribute('aria-disabled'); } else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
      }
    };
    if (ped.pagamento === 'Pix') { const pj = Pix.doPedido(ped); pixChave = !Pix.pronto() ? 'sem-config' : pj ? pj.codigo + (pj.parcial ? '|p' : '') : 'sem-valor'; }
    /* editor de preço do item (não redesenha a lista: o foco fica no campo) */
    const textoPrecoItem = i => {
      const t = D.totais(ped), l = t.linhas[i]; if (!l) return;
      const s = $(`[data-precotxt="${i}"]`, raiz); if (s) {
        const aberto = !$(`[data-preco-ed="${i}"]`, raiz).hidden;
        s.innerHTML = textoPreco(l, ped, i);
        const b = $('[data-edpreco]', s); if (b) b.setAttribute('aria-expanded', String(aberto));
      }
      const v = $(`[data-prvolta="${i}"]`, raiz); if (v) v.hidden = !temPrecoManual(l.item);
    };
    const abrirPreco = (i, abrir) => {
      const ed = $(`[data-preco-ed="${i}"]`, raiz); if (!ed) return;
      ed.hidden = !abrir;
      const b = $(`[data-edpreco="${i}"]`, raiz); if (b) b.setAttribute('aria-expanded', String(abrir));
      if (abrir) { const inp = $(`[data-preco="${i}"]`, raiz); inp.focus(); inp.select(); }
      else if (b) b.focus();
    };
    const voltarPrecoCatalogo = i => {
      const it = ped.itens[i]; if (!it) return;
      const pr = D.produto(it.prod), cat = precoCatalogo(pr, ped);
      if (ped.baixado && cat !== null) { it.preco = cat; it.precoAuto = true; }   // confirmado: volta ao preço congelado do catálogo
      else { delete it.preco; delete it.precoAuto; }
      const inp = $(`[data-preco="${i}"]`, raiz); if (inp) inp.value = cat !== null ? D.paraInput(cat, 2) : '';
      salvarJa(ped); textoPrecoItem(i); atualizar();
    };
    const redesenharItens = (foco) => {
      $('#pdItens', raiz).innerHTML = htmlItens(ped, D.totais(ped));
      atualizar();
      if (foco) { const f = $(foco, raiz); if (f) f.focus(); }
    };

    /* campos do cliente, cupom e taxa */
    raiz.addEventListener('input', e => {
      const k = e.target.dataset.k;
      if (k) {
        if (k === 'taxa') ped.taxa = Math.max(0, D.num(e.target.value) || 0);
        else if (k === 'cupom') ped.cupom = e.target.value.toUpperCase().replace(/\s+/g, '');
        else ped[k] = e.target.value;
        if (k === 'domingo') $('#pdDomAviso', raiz).hidden = !(ped.domingo && D.dataDeISO(ped.domingo).getDay() !== 0);
        agendar(ped); atualizar(); return;
      }
      const iq = e.target.dataset.qtd;
      if (iq !== undefined) {
        const n = D.num(e.target.value); const it = ped.itens[iq];
        if (it && n !== null && n >= 0) { it.qtd = Math.round(n); agendar(ped); atualizar(); }
        return;
      }
      const ip = e.target.dataset.peso;
      if (ip !== undefined) {
        const it = ped.itens[ip]; if (!it) return;
        const n = D.num(e.target.value);
        it.peso = n !== null && n > 0 ? D.arred(n, 3) : null;
        agendar(ped); atualizar();
        return;
      }
      const ipr = e.target.dataset.preco;
      if (ipr !== undefined) {
        const it = ped.itens[ipr]; if (!it) return;
        const n = D.num(e.target.value);
        if (n === null || n < 0) return;   // vazio ou inválido: espera (ao sair do campo, vazio volta ao catálogo)
        it.preco = D.arred(n, 2); delete it.precoAuto;
        agendar(ped); textoPrecoItem(Number(ipr)); atualizar();
        return;
      }
      if (e.target.dataset.troco !== undefined) {
        const n = D.num(e.target.value);
        ped.trocoPara = n !== null && n > 0 ? D.arred(n, 2) : null;
        agendar(ped); atualizar();
      }
    });
    raiz.addEventListener('keydown', e => {
      const ipr = e.target.dataset && e.target.dataset.preco;
      if (ipr === undefined) return;
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); abrirPreco(Number(ipr), false); }
    });
    raiz.addEventListener('change', e => {
      if (e.target.name === 'pdModo') {
        ped.modo = e.target.value; $('#pdEntrega', raiz).hidden = ped.modo === 'Retirada';
        $('#pdTaxaCampo', raiz).hidden = ped.modo === 'Retirada';
        salvarJa(ped); atualizar(); UI.toast(`Modo: ${ped.modo}`); return;
      }
      if (e.target.name === 'pdPg') {
        ped.pagamento = e.target.value;
        if (ped.pagamento !== 'Dinheiro') ped.trocoPara = null;
        const tr = $('#pdTroco', raiz); if (tr && ped.pagamento !== 'Dinheiro') tr.value = '';
        salvarJa(ped); atualizar(); UI.toast(`Pagamento: ${ped.pagamento}`); return;
      }
      if (e.target.dataset.troco !== undefined) { if (ped.trocoPara > 0) e.target.value = D.paraInput(ped.trocoPara, 2); else e.target.value = ''; salvarJa(ped); return; }
      if (e.target.dataset.preco !== undefined) {
        const i = Number(e.target.dataset.preco), it = ped.itens[i]; if (!it) return;
        const n = D.num(e.target.value);
        if (!String(e.target.value).trim()) { if (temPrecoManual(it)) voltarPrecoCatalogo(i); else { const c = precoCatalogo(D.produto(it.prod), ped); e.target.value = c !== null ? D.paraInput(c, 2) : ''; } return; }
        if (n === null || n < 0) { e.target.value = it.preco != null ? D.paraInput(it.preco, 2) : ''; UI.toast('Preço inválido', 'erro'); return; }
        e.target.value = D.paraInput(it.preco ?? n, 2);
        salvarJa(ped); textoPrecoItem(i); return;
      }
      if (e.target.id === 'pdPago') { ped.pago = e.target.checked; salvarJa(ped); atualizar(); UI.toast(ped.pago ? 'Marcado como pago' : 'Marcado como não pago'); return; }
      if (e.target.id === 'pdCupom') { e.target.value = ped.cupom; salvarJa(ped); return; }
      if (e.target.dataset.qtd !== undefined) { const it = ped.itens[e.target.dataset.qtd]; if (it) e.target.value = D.fmtNum(it.qtd, 0); salvarJa(ped); return; }
      if (e.target.dataset.peso !== undefined) { salvarJa(ped); const it = ped.itens[e.target.dataset.peso]; if (it && it.peso > 0) e.target.value = D.paraInput(it.peso); atualizar(); return; }
      if (e.target.dataset.k) salvarJa(ped);
    });

    raiz.addEventListener('click', async e => {
      const b = e.target.closest('button,a'); if (!b) return;
      const d = b.dataset;
      if (d.mais !== undefined || d.menos !== undefined) {
        const i = Number(d.mais ?? d.menos), it = ped.itens[i]; if (!it) return;
        it.qtd = Math.max(1, (Number(it.qtd) || 0) + (d.mais !== undefined ? 1 : -1));
        salvarJa(ped); redesenharItens(`[data-${d.mais !== undefined ? 'mais' : 'menos'}="${i}"]`); return;
      }
      if (d.rm !== undefined) {
        const i = Number(d.rm), it = ped.itens[i]; if (!it) return;
        const pr = D.produto(it.prod);
        if (!await UI.confirmar(`Remover ${pr ? pr.nome : 'este item'} do pedido?`, { sim: 'Remover', perigo: true })) return;
        if (ped.baixado && it.baixa > 0) D.ajustarEstoque(it.prod, it.baixa, `Pedido #${ped.num} alterado`, ped.id);
        ped.itens.splice(i, 1); salvarJa(ped); redesenharItens('[data-add]');
        UI.toast(ped.baixado && it.baixa > 0 ? 'Item removido e devolvido ao estoque' : 'Item removido'); return;
      }
      if (d.edpreco !== undefined) { const i = Number(d.edpreco); const ed = $(`[data-preco-ed="${i}"]`, raiz); abrirPreco(i, !!(ed && ed.hidden)); return; }
      if (d.prok !== undefined) { const inp = $(`[data-preco="${d.prok}"]`, raiz); if (inp) inp.dispatchEvent(new Event('change', { bubbles: true })); abrirPreco(Number(d.prok), false); return; }
      if (d.prvolta !== undefined) { voltarPrecoCatalogo(Number(d.prvolta)); abrirPreco(Number(d.prvolta), false); UI.toast('Voltou ao preço do catálogo'); return; }
      if (d.pixCopiar !== undefined) { const px = Pix.doPedido(ped); if (px) UI.copiar(px.codigo, px.parcial ? 'Código Pix copiado (valor aproximado)' : 'Código Pix copiado'); return; }
      if (b.id === 'pdPixZap' && b.getAttribute('aria-disabled') === 'true') { e.preventDefault(); $('#pdTel', raiz).focus(); UI.toast('Informe o telefone do cliente', 'erro'); return; }
      if (d.add !== undefined) { escolherProduto(ped, () => redesenharItens()); return; }
      if (d.st) { mudar(ped, d.st); return; }
      if (d.cancelar !== undefined) {
        const ok = await UI.confirmar(`Cancelar o pedido #${ped.num}?${ped.baixado ? ' Os itens voltam para o estoque.' : ''}`, { sim: 'Cancelar pedido', perigo: true });
        if (ok) mudar(ped, 'cancelado', true);
        return;
      }
      if (d.copiar !== undefined) { UI.copiar(textoResumo(ped, D.totais(ped)), 'Resumo copiado'); return; }
      if (d.excluir !== undefined) {
        const ok = await UI.confirmar(`Excluir o pedido #${ped.num} de vez?${ped.baixado ? ' Os itens voltam para o estoque.' : ''} Não dá para desfazer.`, { sim: 'Excluir', perigo: true });
        if (!ok) return;
        clearTimeout(timer); timer = null; pendente = null; sujo = null; pedAberto = null;
        const devolveu = ped.baixado;
        if (ped.baixado) D.mudarStatus(ped, 'cancelado');
        const idx = D.estado.pedidos.indexOf(ped); if (idx >= 0) D.estado.pedidos.splice(idx, 1);
        D.salvar(); UI.toast(devolveu ? `Pedido #${ped.num} excluído; estoque devolvido` : `Pedido #${ped.num} excluído`);
        UI.ir('#/pedidos'); return;
      }
      if (b.id === 'pdZap' && b.getAttribute('aria-disabled') === 'true') { e.preventDefault(); $('#pdTel', raiz).focus(); UI.toast('Informe o telefone do cliente', 'erro'); }
    });
  }
};

async function mudar(ped, novo, jaConfirmou) {
  if (novo === ped.status) return;
  if (novo === 'novo' && ped.baixado && !jaConfirmou) {
    if (!await UI.confirmar(`Voltar o pedido #${ped.num} para "Novo"? Os itens voltam para o estoque até você confirmar de novo.`, { sim: 'Voltar para Novo' })) return;
  }
  if (pendente || sujo) salvarJa(ped);
  const tinha = ped.baixado;
  const avisos = D.mudarStatus(ped, novo);
  D.salvar();
  App.redesenhar();
  // App.redesenhar mantém o foco pelo id; se o botão sumiu (cancelar, reabrir, entregue), foca o bloco de status
  const ativo = document.activeElement;
  if (!ativo || ativo === document.body || !ativo.isConnected || !ativo.closest('#tela')) { const st = document.getElementById('pdStatus'); if (st) st.focus({ preventScroll: true }); }
  let msg = `Pedido #${ped.num}: ${D.nomeStatus(novo)}`;
  if (!tinha && ped.baixado) msg += ' · baixa no estoque';
  if (tinha && !ped.baixado) msg += ' · estoque devolvido';
  UI.toast(msg);
  if (avisos.length) {
    UI.abrirDialogo({
      titulo: 'Atenção ao estoque',
      html: `<div class="aviso">${ICON.alerta}<div><p>Alguns itens não saíram do estoque porque falta o peso:</p><ul class="ped-avisos">${avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul><p>Informe o <b>peso real</b> no item: a baixa acontece na hora.</p></div></div>`,
      botoes: [{ texto: 'Entendi', classe: 'btn-1', valor: null }]
    });
  }
}

function escolherProduto(ped, depois) {
  const ativos = D.estado.produtos.filter(p => p.ativo);
  const html = ativos.length ? `<ul class="ped-escolha">${ativos.map(p => {
    const pe = D.precoNoPedido(p, ped), un = esc(D.rotuloVenda(p));
    const sit = D.situacaoEstoque(p);
    const d = D.descontoDo(p, D.diaDoPedido(ped));
    const ja = ped.itens.find(i => i.prod === p.id);
    return `<li><button type="button" class="ped-op" data-prod="${esc(p.id)}">
      ${UI.miniatura(p, 44)}
      <span class="ped-op-meio"><b>${esc(p.nome)}</b>
        <span>${pe === null ? '<span class="ped-falta">Definir preço</span>' : `<span class="num">${esc(D.reais(pe))}${un}</span>${d.pct > 0 ? ` <s class="muted">${esc(D.reais(p.preco))}</s>` : ''}`}
        · <span class="pill tag-${sit}">${esc(D.qtd(p.estoque, p.venda))}</span></span>
      </span>
      <span class="ped-op-fim">${ja ? `<small>${D.fmtNum(ja.qtd, 0)} no pedido</small>` : ''}${ICON.mais}</span>
    </button></li>`;
  }).join('')}</ul>` : UI.vazio('Nenhum produto ativo', 'Ative produtos no catálogo.', '<a class="btn btn-2 btn-sm" href="#/catalogo">Abrir catálogo</a>');
  UI.abrirDialogo({
    titulo: 'Adicionar produto', html,
    botoes: [{ texto: 'Fechar', classe: 'btn-2', valor: null }],
    montar(dlg, fechar) {
      const lista = $('.ped-escolha', dlg); if (!lista) return;
      lista.addEventListener('click', e => {
        const b = e.target.closest('[data-prod]'); if (!b) return;
        const id = b.dataset.prod, pr = D.produto(id);
        let it = ped.itens.find(i => i.prod === id);
        if (it) it.qtd = (Number(it.qtd) || 0) + 1;
        else {
          it = { prod: id, qtd: 1 };
          if (ped.baixado) { const v = D.precoNoPedido(pr, ped); if (v !== null) it.preco = v; }   // pedido confirmado: congela o preço da data do pedido
          ped.itens.push(it);
        }
        salvarJa(ped);
        fechar(null);
        UI.toast(`${pr.nome} adicionado${ped.baixado && it.semBaixa !== true && D.quantidadeEstoque(it) !== null ? ' · baixa no estoque' : ''}`);
        depois();
      });
    }
  });
}
})();
