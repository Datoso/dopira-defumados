/* =====================================================================
   Sistema Dopira · roteador e inicialização
   Cada módulo registra telas em window.TELAS:
     TELAS['pedidos'] = {
       titulo: 'Pedidos' | (params) => string,
       nav: 'pedidos',                 // qual item do menu fica aceso
       voltar: '#/pedidos',            // opcional: mostra botão voltar no topo (celular)
       render(params) => string HTML,  // params = pedaços da rota depois do nome (#/pedido/ID → ['ID'])
       montar(el, params)              // opcional: liga eventos depois de renderizar (el = <main>)
     }
   Rotas: #/inicio · #/pedidos · #/pedido/ID · #/catalogo · #/produto/ID · #/promocoes · #/ajustes
   Para redesenhar a tela atual depois de mudar dados: App.redesenhar()
   ===================================================================== */
(function () {
'use strict';
const { $, $$, esc, ICON, reduz } = UI;
window.TELAS = window.TELAS || {};

const NAV = [
  { id: 'inicio',    nome: 'Início',    href: '#/inicio' },
  { id: 'pedidos',   nome: 'Pedidos',   href: '#/pedidos' },
  { id: 'catalogo',  nome: 'Catálogo',  href: '#/catalogo' },
  { id: 'promocoes', nome: 'Promoções', href: '#/promocoes' }
];

function montarNav() {
  const itens = NAV.map(n => `<a href="${n.href}" data-nav="${n.id}">${ICON[n.id]}<span>${n.nome}</span>${n.id === 'pedidos' ? '<b class="badge" id="badgePedidos" hidden></b>' : ''}</a>`).join('');
  $('#navLateral').innerHTML = itens + `<div class="nav-fim">
      <a href="#/ajustes" data-nav="ajustes">${ICON.ajustes}<span>Ajustes e backup</span></a>
      <a href="${esc(UI.URL_SITE)}" target="_blank" rel="noopener" class="nav-site">${ICON.site}<span>Abrir o site</span></a>
    </div>`;
  $('#navBaixo').innerHTML = itens.replace('id="badgePedidos"', 'id="badgePedidos2"');
}
function atualizarBadge() {
  const n = D.estado.pedidos.filter(p => p.status === 'novo').length;
  ['#badgePedidos', '#badgePedidos2'].forEach(s => { const b = $(s); if (b) { b.hidden = !n; b.textContent = n; } });
}
function faixaExemplo() {
  const f = $('#faixaExemplo'); if (f) f.hidden = !D.estado.exemplo;
}

let rotaAtual = null;
function analisar() {
  const partes = (location.hash || '#/inicio').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const nome = partes[0] || 'inicio';
  return { nome: TELAS[nome] ? nome : 'naoAchou', params: partes.slice(1) };
}
function desenhar(animar) {
  const r = analisar(); const tela = TELAS[r.nome];
  const titulo = typeof tela.titulo === 'function' ? tela.titulo(r.params) : tela.titulo;
  const fazer = () => {
    const main = $('#tela');
    main.innerHTML = tela.render(r.params);
    if (tela.montar) tela.montar(main, r.params);
    $('#tituloTopo').textContent = titulo || 'Sistema Dopira';
    document.title = `${titulo ? titulo + ' · ' : ''}Sistema Dopira`;
    const v = $('#btnVoltar'); v.hidden = !tela.voltar; if (tela.voltar) v.href = tela.voltar;
    $$('[data-nav]').forEach(a => { if (a.dataset.nav === tela.nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    atualizarBadge(); faixaExemplo();
  };
  if (animar && document.startViewTransition && !reduz.matches) document.startViewTransition(fazer).ready.catch(() => {});
  else fazer();
  rotaAtual = r;
}
function navegar() {
  const d = $('#dlg'); if (d && d.open) { const x = $('[data-dlg-fechar]', d); if (x) x.click(); else d.close(); }   // não deixa diálogo agindo sobre outra tela
  const anterior = rotaAtual;
  desenhar(true);
  if (!anterior || anterior.nome !== rotaAtual.nome || anterior.params.join('/') !== rotaAtual.params.join('/')) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('#tela').focus({ preventScroll: true });
  }
}
/** Redesenha a tela atual mantendo a rolagem (use depois de salvar dados). */
function redesenhar() {
  const y = window.scrollY, foco = document.activeElement && document.activeElement.id;
  desenhar(false);
  window.scrollTo(0, y);
  if (foco) { const el = document.getElementById(foco); if (el && el !== document.body) el.focus({ preventScroll: true }); }
}

TELAS.naoAchou = TELAS.naoAchou || {
  titulo: 'Não encontrado', nav: '',
  render: () => UI.vazio('Tela não encontrada', 'Esse endereço não existe no app.', '<a class="btn btn-1" href="#/inicio">Ir para o início</a>')
};

/* importa encomendas do site ao abrir, ao voltar para o app e quando o site salvar algo */
function importar(avisar) {
  const n = D.importDoSiteSeguro();
  if (n) { UI.toast(n === 1 ? '1 encomenda nova do site' : `${n} encomendas novas do site`); if (avisar !== false) redesenhar(); }
}
D.importDoSiteSeguro = () => { try { return D.importarDoSite(); } catch (e) { return 0; } };
window.addEventListener('storage', e => { if (e.key === D.CHAVE_SITE) importar(); if (e.key === D.CHAVE) { D.carregar(); redesenhar(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) importar(); });

D.aoMudar(() => { atualizarBadge(); faixaExemplo(); });

window.App = { redesenhar, navegar, NAV };

function iniciar() {
  montarNav();
  D.importDoSiteSeguro();
  if (!location.hash) history.replaceState(null, '', '#/inicio');
  window.addEventListener('hashchange', navegar);
  desenhar(false);
  if (D.avisoCarga) setTimeout(() => UI.toast(D.avisoCarga, 'erro'), 400);
  // PWA: só em https
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
