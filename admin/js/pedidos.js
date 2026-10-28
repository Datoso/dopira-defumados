/* =====================================================================
   Dopira Gestão · módulo Pedidos
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
let timer = null, pendente = null, aposSalvar = null;
function salvarJa(ped) {
  clearTimeout(timer); timer = null; pendente = null;
  sincronizarEstoque(ped); D.salvar();
  const f = aposSalvar; aposSalvar = null; if (f) try { f(); } catch (e) {}
}
function agendar(ped, depois) {
  pendente = ped; aposSalvar = depois || null; clearTimeout(timer);
  timer = setTimeout(() => { if (pendente) salvarJa(pendente); }, 400);
}
window.addEventListener('hashchange', () => { if (pendente) salvarJa(pendente); });
window.addEventListener('pagehide', () => { if (pendente) salvarJa(pendente); });

function textoPreco(l) {
  const prod = l.prod; if (!prod) return '<span class="muted">Produto removido</span>';
  const un = prod.venda === 'un' ? '/un' : '/kg';
  if (l.preco === null) return `<a class="ped-falta" href="#/produto/${encodeURIComponent(prod.id)}">Definir preço</a>`;
  if (l.item.preco !== undefined && l.item.preco !== null) return `<span class="num">${esc(D.reais(l.preco))}${un}</span> <small class="muted">preço da confirmação</small>`;
  const d = D.descontoDo(prod);
  if (d.pct > 0 && prod.preco !== null) {
    const rot = d.origem === 'promocao' ? `promo −${D.fmtNum(d.pct, 1)}%` : `−${D.fmtNum(d.pct, 1)}%`;
    return `<s class="muted">${esc(D.reais(prod.preco))}</s> <span class="num">${esc(D.reais(l.preco))}${un}</span> <span class="pill tag-promo">${esc(rot)}</span>`;
  }
  return `<span class="num">${esc(D.reais(l.preco))}${un}</span>`;
}
function textoValor(l) {
  if (l.valor !== null) return `<b class="num">${l.estimado ? '≈ ' : ''}${esc(D.reais(l.valor))}</b>`;
  return '<span class="ped-conf">a confirmar</span>';
}
function textoEstimativa(l) {
  const prod = l.prod; if (!prod || prod.venda !== 'kg') return '';
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
        <span class="ped-item-preco">${textoPreco(l)}</span>
      </div>
      <button type="button" class="btn-ic ped-rm" data-rm="${i}" aria-label="Remover ${esc(prod ? prod.nome : 'item')}">${ICON.lixo}</button>
    </div>
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
      <button type="button" class="btn btn-2 btn-sm" data-st="novo">Reabrir pedido</button>
    </div>`;
  }
  const atual = FLUXO.indexOf(ped.status);
  const passos = FLUXO.map((s, i) => `<li><button type="button" class="ped-passo${i < atual ? ' feito' : ''}${i === atual ? ' atual' : ''}" data-st="${s}" ${i === atual ? 'aria-current="step"' : ''}>
      <span class="ped-bola">${i < atual ? ICON.check : i + 1}</span><span>${esc(D.nomeStatus(s))}</span></button></li>`).join('');
  const prox = FLUXO[atual + 1];
  return `<div class="ped-status card">
    <ol class="ped-fluxo" aria-label="Andamento do pedido">${passos}</ol>
    <div class="ped-status-acoes">
      ${prox ? `<button type="button" class="btn btn-3" data-st="${prox}">${ICON.check}${esc(ACAO[ped.status])}</button>` : `<p class="ped-fim">${ICON.check}Pedido entregue${ped.pago ? ' e pago' : ''}.</p>`}
      <button type="button" class="btn-link ped-canc" data-cancelar>Cancelar pedido</button>
    </div>
    <p class="ped-nota">${ped.baixado ? 'Os itens já saíram do estoque. Cancelar devolve; mudar itens ou pesos acerta o estoque na hora.' : 'Ao confirmar, os itens saem do estoque. Cancelar devolve.'}</p>
  </div>`;
}

function msgZap(ped, t) {
  const nome = (ped.cliente || '').trim().split(/\s+/)[0];
  const itens = t.linhas.map(l => {
    const pr = l.prod, n = pr ? pr.nome : 'Produto';
    let s = pr && pr.venda === 'un' ? `• ${D.fmtNum(l.item.qtd, 0)} ${n}` : `• ${D.fmtNum(l.item.qtd, 0)} ${unidadeQtd(pr, l.item.qtd)} de ${n}`;
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
    `Total${!t.completo ? ' parcial' : ''}: ${est && t.completo ? '≈ ' : ''}${D.reais(t.total)}${!t.completo ? ' (a confirmar)' : ''}`
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
      <div id="pdStatus">${htmlStatus(ped)}</div>

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
              <div class="campo">
                <label for="pdTaxa">Taxa de entrega</label>
                <div class="campo-in"><input id="pdTaxa" data-k="taxa" inputmode="decimal" value="${esc(ped.taxa ? D.paraInput(ped.taxa, 2) : '')}" placeholder="0,00"><span class="suf">R$</span></div>
              </div>
            </div>
            <div id="pdResumo">${htmlResumo(ped, t)}</div>
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
        agendar(ped, ped.baixado ? atualizar : null); atualizar();
      }
    });
    raiz.addEventListener('change', e => {
      if (e.target.name === 'pdModo') {
        ped.modo = e.target.value; $('#pdEntrega', raiz).hidden = ped.modo === 'Retirada';
        salvarJa(ped); atualizar(); UI.toast(`Modo: ${ped.modo}`); return;
      }
      if (e.target.id === 'pdPago') { ped.pago = e.target.checked; salvarJa(ped); UI.toast(ped.pago ? 'Marcado como pago' : 'Marcado como não pago'); return; }
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
        clearTimeout(timer); pendente = null;
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
  if (pendente) salvarJa(ped);
  const tinha = ped.baixado;
  const avisos = D.mudarStatus(ped, novo);
  D.salvar();
  App.redesenhar();
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
    const pe = D.precoEfetivo(p), un = p.venda === 'un' ? '/un' : '/kg';
    const sit = D.situacaoEstoque(p);
    const d = D.descontoDo(p);
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
          if (ped.baixado) { const v = D.precoEfetivo(pr); if (v !== null) it.preco = v; }   // pedido confirmado: congela o preço como no resto
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
