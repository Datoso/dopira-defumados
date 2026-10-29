/* =====================================================================
   Sistema Dopira · Ajustes
   Pix para receber, backup (baixar/restaurar), dados de exemplo,
   apagar tudo, instalar o app (PWA) e sobre.
   ===================================================================== */
(function () {
'use strict';
const { $, esc, ICON } = UI;
window.TELAS = window.TELAS || {};

const CHAVE_BACKUP = 'dopira-admin-ultimo-backup';
const svgPeq = d => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  restaurar: svgPeq('<path d="M12 20V8M7 13l5-5 5 5M5 4h14"/>'),
  celular:   svgPeq('<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>'),
  info:      svgPeq('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>'),
  pix:       svgPeq('<path d="M12 2.5 21.5 12 12 21.5 2.5 12Z"/><path d="m8 12 4-4 4 4-4 4Z"/>'),
  teste:     svgPeq('<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>')
};

/* ---------- instalar o app (PWA) ---------- */
let promptInstalar = null;
const ehStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
const naTela = () => /^#\/(ajustes|inicio)?$/.test(location.hash.split('/').slice(0, 2).join('/')) || !location.hash;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); promptInstalar = e;
  if (window.App && naTela()) App.redesenhar();
});
window.addEventListener('appinstalled', () => {
  promptInstalar = null; UI.toast('App instalado');
  if (window.App && naTela()) App.redesenhar();
});
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

async function pedirInstalacao() {
  if (promptInstalar) {
    const p = promptInstalar; promptInstalar = null;
    try {
      p.prompt();
      const r = await p.userChoice;
      UI.toast(r && r.outcome === 'accepted' ? 'Instalando o app…' : 'Instalação cancelada');
    } catch (e) { mostrarInstrucoes(); }
    if (window.App && naTela()) App.redesenhar();
    return;
  }
  mostrarInstrucoes();
}
function mostrarInstrucoes() {
  const android = `<li class="aj-inst"><b>Android (Chrome)</b><span>Toque no menu <kbd>⋮</kbd> no canto de cima e escolha <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</span></li>`;
  const ios = `<li class="aj-inst"><b>iPhone (Safari)</b><span>Toque em <b>Compartilhar</b> <kbd>⬆︎</kbd> na barra de baixo e escolha <b>Adicionar à Tela de Início</b>.</span></li>`;
  const pc = `<li class="aj-inst"><b>Computador (Chrome ou Edge)</b><span>Clique no ícone de instalar na barra de endereço, ou no menu <kbd>⋮</kbd> → <b>Instalar Sistema Dopira</b>.</span></li>`;
  const aviso = location.protocol !== 'https:'
    ? `<p class="aviso">${ICON.alerta}<span>A instalação só funciona com o app aberto no endereço publicado (https), não pelo arquivo no computador.</span></p>` : '';
  UI.abrirDialogo({
    titulo: 'Instalar o app',
    html: `${aviso}<p class="aj-dlg-p">Abra este endereço no navegador do celular e siga o passo do seu aparelho:</p>
      <ol class="aj-inst-lista">${ehIOS() ? ios + android : android + ios}${pc}</ol>
      <p class="muted aj-dlg-p">Depois disso, o Sistema Dopira abre direto pelo ícone, em tela cheia.</p>`,
    botoes: [{ texto: 'Entendi', classe: 'btn-1', valor: null }]
  });
}
window.DopiraInstalar = { pedir: pedirInstalacao, get disponivel() { return !!promptInstalar; }, instalado: ehStandalone };

/* ---------- Pix para receber ---------- */
const DICA_TIPO = {
  celular:   { ph: '(18) 99649-1204', im: 'tel' },
  cpf:       { ph: '000.000.000-00', im: 'numeric' },
  cnpj:      { ph: '00.000.000/0000-00', im: 'numeric' },
  email:     { ph: 'voce@email.com', im: 'email' },
  aleatoria: { ph: '123e4567-e89b-12d3-a456-426614174000', im: 'text' }
};
/** Mostra a chave salva de um jeito fácil de ler: +5518996491204 → (18) 99649-1204 */
function chaveLegivel(c) {
  if (!c || !c.chave) return '';
  if (c.tipo === 'celular') { const d = c.chave.replace(/\D/g, '').replace(/^55/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : c.chave; }
  if (c.tipo === 'cpf' && c.chave.length === 11) return c.chave.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (c.tipo === 'cnpj' && c.chave.length === 14) return c.chave.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return c.chave;
}
const nomeNoBanco = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .,\-\/@+]/g, '').trim().slice(0, 25).toUpperCase();
function codigoTeste() {
  const c = Pix.config();
  try { return Pix.codigo({ chave: c.chave, nome: c.nome, cidade: c.cidade, valor: 1, txid: 'DOPIRATESTE', mensagem: 'Teste Dopira' }); } catch (e) { return ''; }
}
function htmlPixTeste() {
  if (!Pix.pronto()) return `<div class="aj-pix-vazio"><b>Ainda sem chave Pix.</b> Depois de salvar, aparece aqui um código de teste para você conferir no app do seu banco.</div>`;
  const c = Pix.config(), cod = codigoTeste();
  return `<div class="aj-pix-teste">
    <div class="aj-pix-qr">${Pix.qrSVG(cod, 148)}</div>
    <div class="aj-pix-teste-txt">
      <h4>Código de teste de R$ 1,00</h4>
      <p>Pague com o app do seu banco (Pix copia e cola ou lendo o QR) e <b>confira se o nome que aparece é o seu</b> antes de usar nos pedidos.</p>
      <p class="aj-pix-quem">Recebedor: <b>${esc(nomeNoBanco(c.nome))}</b> · chave ${esc(chaveLegivel(c))}</p>
      <label class="sr" for="ajPixCod">Código Pix de teste</label>
      <textarea id="ajPixCod" class="aj-pix-cod" readonly rows="3" spellcheck="false">${esc(cod)}</textarea>
      <button type="button" class="btn btn-2 btn-sm" data-pix-copiar>${ICON.copiar} Copiar código de teste</button>
    </div>
  </div>`;
}
function htmlPix() {
  const c = Pix.config(), tipo = Pix.TIPOS.some(t => t.id === c.tipo) ? c.tipo : 'celular', dt = DICA_TIPO[tipo];
  return `<section class="card aj-card aj-pix" aria-labelledby="tPix">
    <h3 id="tPix">${IC.pix} Pix para receber ${Pix.pronto() ? '<span class="pill tag-ok aj-pix-st" id="ajPixSt">Ativo</span>' : '<span class="pill tag-baixo aj-pix-st" id="ajPixSt">Falta cadastrar</span>'}</h3>
    <p>O código Pix de cada pedido é gerado aqui no próprio app, <b>sem taxa e sem banco intermediário</b>: o dinheiro cai direto na conta da chave.</p>
    <div class="aj-pix-grade">
      <form class="form aj-pix-form" id="ajPixForm" novalidate>
        <div class="campo">
          <label for="ajPixTipo">Tipo de chave</label>
          <div class="campo-in"><select id="ajPixTipo">${Pix.TIPOS.map(t => `<option value="${esc(t.id)}" ${t.id === tipo ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></div>
        </div>
        <div class="campo" id="ajPixChaveC">
          <label for="ajPixChave">Chave Pix</label>
          <div class="campo-in"><input id="ajPixChave" value="${esc(chaveLegivel(c))}" placeholder="${esc(dt.ph)}" inputmode="${dt.im}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="ajPixChaveE"></div>
          <small class="dica aj-erro" id="ajPixChaveE" aria-live="polite"></small>
        </div>
        <div class="campo" id="ajPixNomeC">
          <label for="ajPixNome">Nome do recebedor</label>
          <div class="campo-in"><input id="ajPixNome" value="${esc(c.nome)}" maxlength="25" autocomplete="off" placeholder="Como aparece no banco" aria-describedby="ajPixNomeD ajPixNomeE"></div>
          <small class="dica" id="ajPixNomeD">Como aparece no seu banco, até 25 letras (vai sem acento).</small>
          <small class="dica aj-erro" id="ajPixNomeE" aria-live="polite"></small>
        </div>
        <div class="campo">
          <label for="ajPixCidade">Cidade</label>
          <div class="campo-in"><input id="ajPixCidade" value="${esc(c.cidade || 'Pirapozinho')}" maxlength="15" autocomplete="off"></div>
        </div>
        <div class="aj-acoes"><button type="submit" class="btn btn-1" data-pix-salvar>${ICON.check} Salvar chave Pix</button></div>
      </form>
      <div id="ajPixTeste" aria-live="polite">${htmlPixTeste()}</div>
    </div>
  </section>`;
}
function montarPix(raiz) {
  const f = $('#ajPixForm', raiz); if (!f) return;
  const tipo = $('#ajPixTipo', f), chave = $('#ajPixChave', f), nome = $('#ajPixNome', f), cidade = $('#ajPixCidade', f);
  const erro = (campo, el, msg) => { if (msg) campo.dataset.erro = '1'; else delete campo.dataset.erro; el.textContent = msg || ''; };
  tipo.addEventListener('change', () => {
    const dt = DICA_TIPO[tipo.value] || DICA_TIPO.celular;
    chave.placeholder = dt.ph; chave.inputMode = dt.im;
    erro($('#ajPixChaveC', f), $('#ajPixChaveE', f), '');
    chave.focus();
  });
  chave.addEventListener('input', () => erro($('#ajPixChaveC', f), $('#ajPixChaveE', f), ''));
  nome.addEventListener('input', () => erro($('#ajPixNomeC', f), $('#ajPixNomeE', f), ''));
  f.addEventListener('submit', e => {
    e.preventDefault();
    const r = Pix.normalizarChave(chave.value, tipo.value);
    const n = nome.value.trim().replace(/\s+/g, ' ');
    erro($('#ajPixChaveC', f), $('#ajPixChaveE', f), r.erro || '');
    erro($('#ajPixNomeC', f), $('#ajPixNomeE', f), n ? (nomeNoBanco(n) ? '' : 'Use letras no nome') : 'Informe o nome do recebedor');
    if (r.erro) { chave.focus(); return; }
    if (!n || !nomeNoBanco(n)) { nome.focus(); return; }
    D.estado.pix = { chave: r.chave, tipo: tipo.value, nome: n, cidade: cidade.value.trim().replace(/\s+/g, ' ') || 'Pirapozinho' };
    D.salvar();
    chave.value = chaveLegivel(D.estado.pix); nome.value = n; cidade.value = D.estado.pix.cidade;
    $('#ajPixTeste', raiz).innerHTML = htmlPixTeste();
    const st = $('#ajPixSt', raiz); if (st) { st.className = 'pill tag-ok aj-pix-st'; st.textContent = 'Ativo'; }
    UI.toast('Chave Pix salva. Faça o teste de R$ 1,00');
  });
}

/* ---------- backup ---------- */
const ultimoBackup = () => { try { return localStorage.getItem(CHAVE_BACKUP) || ''; } catch (e) { return ''; } };
function baixarBackup() {
  const nome = `dopira-gestao-backup-${D.hojeISO()}.json`;
  const blob = new Blob([JSON.stringify(D.estado, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  try { localStorage.setItem(CHAVE_BACKUP, new Date().toISOString()); } catch (e) {}
  UI.toast('Backup baixado: ' + nome);
  App.redesenhar();
}
async function restaurarBackup(arquivo) {
  if (!arquivo) return;
  let obj;
  try {
    if (arquivo.size > 20 * 1024 * 1024) throw new Error('grande');
    obj = JSON.parse(await arquivo.text());
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.produtos)) throw new Error('formato');
  } catch (e) {
    UI.abrirDialogo({ titulo: 'Arquivo inválido', html: `<p class="aviso aviso-erro">${ICON.alerta}<span>“${esc(arquivo.name)}” não é um backup do Sistema Dopira. Escolha o arquivo <b>dopira-gestao-backup-….json</b> baixado neste app.</span></p>`, botoes: [{ texto: 'Fechar', classe: 'btn-2', valor: null }] });
    return;
  }
  const n = k => Array.isArray(obj[k]) ? obj[k].length : 0;
  const ok = await UI.abrirDialogo({
    titulo: 'Restaurar backup?',
    html: `<p class="aj-dlg-p">O arquivo <b>${esc(arquivo.name)}</b> tem:</p>
      <ul class="aj-resumo"><li><b class="num">${n('produtos')}</b> produtos</li><li><b class="num">${n('pedidos')}</b> pedidos</li><li><b class="num">${n('cupons')}</b> cupons</li><li><b class="num">${n('promocoes')}</b> promoções</li></ul>
      <p class="aviso aviso-erro">${ICON.alerta}<span>Tudo o que está agora neste aparelho será <b>substituído</b> pelo backup. Se quiser guardar os dados atuais, baixe um backup antes.</span></p>`,
    botoes: [{ texto: 'Cancelar', classe: 'btn-2', valor: false }, { texto: 'Substituir dados', classe: 'btn-perigo', valor: true }]
  });
  if (ok !== true) return;
  try { D.substituirEstado(obj); }
  catch (e) { UI.toast('Não foi possível restaurar esse arquivo', 'erro'); return; }
  App.redesenhar();
  UI.toast('Backup restaurado');
}

/* ---------- apagar ---------- */
async function apagarTudo() {
  const r = await UI.abrirDialogo({
    titulo: 'Apagar todos os dados',
    html: `<form class="form" novalidate>
      <p class="aviso aviso-erro">${ICON.alerta}<span>Isso apaga <b>pedidos, preços, estoque, cupons e promoções</b> deste aparelho. Não tem como desfazer, a não ser com um backup.</span></p>
      <div class="campo" id="cApagar"><label for="txtApagar">Para confirmar, digite APAGAR</label>
        <div class="campo-in"><input id="txtApagar" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="erroApagar"></div>
        <small class="dica aj-erro" id="erroApagar" aria-live="polite"></small></div>
    </form>`,
    botoes: [
      { texto: 'Cancelar', classe: 'btn-2', valor: false },
      { texto: 'Apagar tudo', classe: 'btn-perigo', valor: true, antes: d => {
        const v = $('#txtApagar', d).value.trim().toUpperCase();
        if (v === 'APAGAR') return true;
        $('#cApagar', d).dataset.erro = '1';
        $('#erroApagar', d).textContent = 'Digite APAGAR (em letras maiúsculas ou minúsculas) para confirmar.';
        $('#txtApagar', d).focus();
        return false;
      } }
    ],
    montar: d => { const f = $('form', d); f.onsubmit = e => { e.preventDefault(); $('[data-dlg-btn="1"]', d).click(); }; }
  });
  if (r !== true) return;
  D.apagarTudo(); App.redesenhar(); UI.toast('Todos os dados foram apagados');
}

/* ---------- tela ---------- */
function tamanho() {
  try { const b = new Blob([JSON.stringify(D.estado)]).size; return b < 1024 ? `${b} bytes` : `${D.fmtNum(b / 1024, 1)} KB`; } catch (e) { return '—'; }
}
function render() {
  const est = D.estado, ub = ultimoBackup();
  const temDados = est.pedidos.length > 0 || est.produtos.some(p => p.preco !== null);
  const instalado = ehStandalone();
  return `<div class="aj">
    <header class="cab"><div><h2>Ajustes</h2><p>Pix, backup, dados de teste e instalação do app.</p></div></header>


    ${htmlPix()}

    <p class="aj-intro">${ICON.caixa}<span>Os dados ficam salvos <b>só neste aparelho</b>, no navegador. Faça backup de vez em quando para não perder nada, e para passar tudo para outro celular ou computador.</span></p>

    <section class="card aj-card aj-publicar" aria-labelledby="tPub">
      <h3 id="tPub">${UI.ICON.site} Preços e Pix no site</h3>
      <p>O site mostra os preços e gera o Pix com o valor <b>antes</b> do cliente mandar a encomenda no WhatsApp. Sempre que mudar preços, descontos, promoções, cupons ou a chave Pix, gere o arquivo <b>precos.json</b> e coloque na pasta do site (no GitHub: <i>Add file › Upload files</i> no repositório dopira-defumados).</p>
      <p class="aj-meta">${(() => { const d = D.dadosPublicos(); const sem = d.produtos.filter(p => p.ativo && p.preco === null).length; return `${sem ? `<b>${sem} produto(s) sem preço</b> vão aparecer como “Sob consulta”. ` : 'Todos os produtos ativos têm preço. '}${d.pix ? 'Chave Pix cadastrada.' : '<b>Sem chave Pix:</b> o site não gera o código até você cadastrar.'}`; })()}</p>
      <div class="aj-acoes"><button type="button" class="btn btn-1" data-publicar>${ICON.baixar} Gerar precos.json</button></div>
    </section>

    <div class="aj-grade">
      <section class="card aj-card" aria-labelledby="tBackup">
        <h3 id="tBackup">${ICON.baixar} Backup</h3>
        <p>Baixa um arquivo com produtos, preços, estoque, cupons, promoções e pedidos. Guarde no Google Drive ou mande para você no WhatsApp.</p>
        <p class="aj-meta">${ub ? `Último backup: <b>${esc(D.fmtDataHora(ub))}</b>` : 'Nenhum backup feito neste aparelho ainda.'}</p>
        <div class="aj-acoes">
          <button type="button" class="btn btn-1" data-baixar>${ICON.baixar} Baixar backup</button>
          <input type="file" id="arqBackup" class="sr" accept=".json,application/json">
          <label for="arqBackup" class="btn btn-2 aj-arq">${IC.restaurar} Restaurar backup</label>
        </div>
      </section>

      <section class="card aj-card" aria-labelledby="tEx">
        <h3 id="tEx">${IC.teste} Dados de exemplo</h3>
        ${est.exemplo
          ? `<p>Você está usando <b>dados de exemplo (fictícios)</b>. Quando quiser começar de verdade, apague tudo e defina seus preços e estoque.</p>
             <div class="aj-acoes"><button type="button" class="btn btn-perigo" data-apagar-ex>${ICON.lixo} Apagar exemplos e começar do zero</button></div>`
          : `<p>Carrega preços, estoque e pedidos <b>fictícios</b> para testar o app sem medo.</p>
             ${temDados ? `<p class="aviso">${ICON.alerta}<span>Isso <b>substitui os dados atuais</b>. Baixe um backup antes se quiser guardá-los.</span></p>` : ''}
             <div class="aj-acoes"><button type="button" class="btn btn-2" data-carregar-ex>Carregar dados de exemplo (fictícios)</button></div>`}
      </section>

      ${instalado ? '' : `<section class="card aj-card" aria-labelledby="tInst">
        <h3 id="tInst">${IC.celular} Instalar o app</h3>
        <p>Coloque o Sistema Dopira na tela inicial do celular: abre em tela cheia, como um aplicativo.</p>
        <div class="aj-acoes"><button type="button" class="btn btn-3" data-instalar>${IC.celular} ${promptInstalar ? 'Instalar agora' : 'Como instalar'}</button></div>
      </section>`}

      <section class="card aj-card aj-perigo" aria-labelledby="tApagar">
        <h3 id="tApagar">${ICON.lixo} Apagar todos os dados</h3>
        <p>Volta o app para o começo: catálogo sem preços, sem pedidos e só o cupom PRIMEIRACOMPRA.</p>
        <div class="aj-acoes"><button type="button" class="btn btn-2 aj-btn-perigo" data-apagar>${ICON.lixo} Apagar todos os dados</button></div>
      </section>
    </div>

    <section class="aj-sobre" aria-labelledby="tSobre">
      <img src="../img/logo.png" alt="" width="48" height="48" onerror="this.remove()">
      <div>
        <h3 id="tSobre">Sistema Dopira <small>· protótipo de teste</small></h3>
        <p>${est.produtos.length} produtos · ${est.pedidos.length} pedidos · ${esc(tamanho())} salvos neste navegador</p>
        <a class="btn-link" href="${esc(UI.URL_SITE)}" target="_blank" rel="noopener">Abrir o site da do'Pira Defumados</a>
      </div>
    </section>
  </div>`;
}
function montar(el) {
  const raiz = $('.aj', el); if (!raiz) return;
  raiz.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-pix-copiar')) { const c = codigoTeste(); if (c) UI.copiar(c, 'Código de teste copiado'); }
    else if (b.hasAttribute('data-baixar')) baixarBackup();
    else if (b.hasAttribute('data-publicar')) {
      const blob = new Blob([JSON.stringify(D.dadosPublicos(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'precos.json'; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      UI.toast('precos.json baixado. Envie para a pasta do site.');
    }
    else if (b.hasAttribute('data-instalar')) pedirInstalacao();
    else if (b.hasAttribute('data-apagar')) apagarTudo();
    else if (b.hasAttribute('data-apagar-ex')) {
      if (!await UI.confirmar('Apagar os dados de exemplo e começar do zero? O catálogo volta sem preços e sem pedidos.', { sim: 'Apagar exemplos', perigo: true })) return;
      D.apagarTudo(); App.redesenhar(); UI.toast('Exemplos apagados. Bom começo!');
    }
    else if (b.hasAttribute('data-carregar-ex')) {
      const temDados = D.estado.pedidos.length > 0 || D.estado.produtos.some(p => p.preco !== null);
      if (!await UI.confirmar(temDados ? 'Os dados atuais serão substituídos por dados de exemplo fictícios. Continuar?' : 'Carregar preços, estoque e pedidos fictícios para testar?', { sim: 'Carregar exemplo', perigo: temDados })) return;
      D.carregarExemplo(); App.redesenhar(); UI.toast('Dados de exemplo carregados');
    }
  });
  montarPix(raiz);
  const arq = $('#arqBackup', raiz);
  arq.addEventListener('change', () => { const f = arq.files && arq.files[0]; arq.value = ''; restaurarBackup(f); });
}

TELAS.ajustes = { titulo: 'Ajustes', nav: 'ajustes', voltar: '#/inicio', render, montar };
})();
