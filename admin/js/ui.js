/* =====================================================================
   Sistema Dopira · peças de interface compartilhadas
   ===================================================================== */
(function () {
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduz = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- ícones (SVG, traço) ---------- */
const svg = d => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  inicio:    svg('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>'),
  pedidos:   svg('<path d="M8 4h8l1 3H7l1-3Z"/><rect x="4" y="7" width="16" height="14" rx="2"/><path d="M8 12h8M8 16h5"/>'),
  catalogo:  svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  promocoes: svg('<path d="M20 12 12 20 4 12V4h8l8 8Z"/><circle cx="8.5" cy="8.5" r="1.5"/>'),
  site:      svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  ajustes:   svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  mais:      svg('<path d="M12 5v14M5 12h14"/>'),
  menos:     svg('<path d="M5 12h14"/>'),
  voltar:    svg('<path d="M15 18 9 12l6-6"/>'),
  seta:      svg('<path d="m9 18 6-6-6-6"/>'),
  lixo:      svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  editar:    svg('<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>'),
  zap:       '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.6-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>',
  copiar:    svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  compartilhar: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  baixar:    svg('<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>'),
  alerta:    svg('<path d="M12 3 2 21h20L12 3Z"/><path d="M12 10v5M12 18h.01"/>'),
  check:     svg('<path d="m5 12 5 5L20 7"/>'),
  caixa:     svg('<path d="M3 7l9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>'),
  fogo:      svg('<path d="M12 22c4 0 7-2.7 7-7 0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-5-3-7 0 4-4 6-4 12 0 4.3 3 8 7 8Z"/>'),
  busca:     svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  x:         svg('<path d="M6 6l12 12M18 6 6 18"/>')
};

/* ---------- toast ---------- */
let toastT;
function toast(msg, tipo = '') {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.dataset.tipo = tipo; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

/* ---------- diálogo (bottom sheet no celular, janela no PC) ----------
   abrirDialogo({ titulo, html, botoes:[{texto, classe, valor}], montar(el, fechar) })
   → Promise com o "valor" do botão clicado (ou null se fechou). Use <form> dentro do html
   se quiser; botões com valor 'ok' disparam validação HTML do form (#dlg form). */
function abrirDialogo({ titulo = '', html = '', botoes = [{ texto: 'Fechar', classe: 'btn-2', valor: null }], montar } = {}) {
  return new Promise(resolve => {
    const d = $('#dlg');
    if (d.open) d.close();
    d.innerHTML = `<div class="dlg-cx">
      <header class="dlg-topo"><h2 id="dlgTitulo">${esc(titulo)}</h2><button type="button" class="btn-ic" data-dlg-fechar aria-label="Fechar">${ICON.x}</button></header>
      <div class="dlg-corpo">${html}</div>
      ${botoes.length ? `<footer class="dlg-acoes">${botoes.map((b, i) => `<button type="button" class="btn ${b.classe || 'btn-2'}" data-dlg-btn="${i}">${esc(b.texto)}</button>`).join('')}</footer>` : ''}
    </div>`;
    d.setAttribute('aria-labelledby', 'dlgTitulo');
    let feito = false;
    const fechar = v => { if (feito) return; feito = true; d.close(); resolve(v === undefined ? null : v); };
    d.onclick = e => {
      if (e.target === d || e.target.closest('[data-dlg-fechar]')) return fechar(null);
      const b = e.target.closest('[data-dlg-btn]'); if (!b) return;
      const cfg = botoes[Number(b.dataset.dlgBtn)];
      const f = $('form', d);
      if (cfg.valor === 'ok' && f && !f.reportValidity()) return;
      if (cfg.antes && cfg.antes(d) === false) return;
      fechar(cfg.valor);
    };
    d.oncancel = e => { e.preventDefault(); fechar(null); };
    const f = $('form', d); if (f) f.onsubmit = e => { e.preventDefault(); const ok = botoes.findIndex(b => b.valor === 'ok'); if (ok >= 0) $(`[data-dlg-btn="${ok}"]`, d).click(); };
    d.showModal();
    if (montar) montar(d, fechar);
    const primeiro = $('input,select,textarea', $('.dlg-corpo', d));
    if (primeiro && matchMedia('(pointer:fine)').matches) primeiro.focus();
  });
}
function confirmar(msg, { sim = 'Confirmar', perigo = false } = {}) {
  return abrirDialogo({ titulo: 'Confirmar', html: `<p>${esc(msg)}</p>`, botoes: [
    { texto: 'Cancelar', classe: 'btn-2', valor: false },
    { texto: sim, classe: perigo ? 'btn-perigo' : 'btn-1', valor: true }
  ] }).then(v => v === true);
}

/* ---------- navegação ---------- */
const ir = hash => { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; };

/* ---------- pedaços prontos de HTML ---------- */
const pillStatus = st => `<span class="pill st-${esc(st)}">${esc(D.nomeStatus(st))}</span>`;
const vazio = (titulo, texto = '', acao = '') => `<div class="vazio">${ICON.caixa}<h3>${esc(titulo)}</h3>${texto ? `<p>${esc(texto)}</p>` : ''}${acao}</div>`;
/** Miniatura do produto: foto se existir, senão as iniciais. */
const miniatura = (prod, tam = 48) => {
  const ini = esc((prod?.nome || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase());
  return `<span class="mini" style="--t:${tam}px" data-ini="${ini}">${prod?.img ? `<img src="${esc(prod.img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
};
/** Campo de formulário padrão. */
const campo = ({ id, rotulo, valor = '', tipo = 'text', dica = '', attrs = '', sufixo = '' }) =>
  `<div class="campo"><label for="${id}">${esc(rotulo)}</label><div class="campo-in">${tipo === 'textarea'
    ? `<textarea id="${id}" ${attrs}>${esc(valor)}</textarea>`
    : `<input id="${id}" type="${tipo}" value="${esc(valor)}" ${attrs}>`}${sufixo ? `<span class="suf">${esc(sufixo)}</span>` : ''}</div>${dica ? `<small class="dica">${esc(dica)}</small>` : ''}</div>`;
/** Interruptor liga/desliga. */
const interruptor = (id, ligado, rotulo) => `<label class="sw"><input type="checkbox" role="switch" id="${id}" ${ligado ? 'checked' : ''}><span class="sw-t" aria-hidden="true"></span><span>${esc(rotulo)}</span></label>`;

/** Link do WhatsApp para um telefone brasileiro (aceita com ou sem DDD/55). */
function linkZap(tel, texto = '') {
  let d = D.soDigitos(tel);
  if (!d) return '';
  if (d.length <= 11) d = '55' + (d.length <= 9 ? '18' + d : d);
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}
async function copiar(txt, msg = 'Copiado') {
  try { await navigator.clipboard.writeText(txt); toast(msg); }
  catch (e) { abrirDialogo({ titulo: 'Copie o texto', html: `<textarea class="copiavel" rows="6" readonly>${esc(txt)}</textarea>` }); }
}

// o site fica uma pasta acima do app; no endereço https usa a pasta, no PC (file://) aponta o index.html
const URL_SITE = new URL(location.protocol === 'file:' ? '../index.html' : '../', location.href).href;

window.UI = { $, $$, esc, reduz, ICON, toast, abrirDialogo, confirmar, ir, pillStatus, vazio, miniatura, campo, interruptor, linkZap, copiar, URL_SITE };
})();
