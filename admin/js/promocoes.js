/* =====================================================================
   Dopira Gestão · Promoções e cupons  (#/promocoes)
   - Cupons de desconto (D.estado.cupons): o cliente digita no site ao encomendar.
   - Promoções de produtos (D.estado.promocoes): desconto % por período.
   ===================================================================== */
(function () {
'use strict';
const { $, $$, esc, ICON } = UI;
window.TELAS = window.TELAS || {};

const svg = d => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>'),
  cupom: svg('<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4V8Z"/><path d="M9.5 9.5h.01M14.5 14.5h.01M15 9l-6 6"/>'),
  relogio: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')
};

let aba = 'cupons';          // aba aberta no celular: 'cupons' | 'promocoes'
function mudarAba(a) { aba = a; if (location.hash.startsWith('#/promocoes')) history.replaceState(null, '', '#/promocoes/' + a); }

/* ---------- utilidades ---------- */
const hoje = () => D.hojeISO();
/** "30/11" (com ano se não for o ano atual) */
function ddmm(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}${Number(y) !== new Date().getFullYear() ? '/' + y : ''}`;
}
const n2 = n => D.fmtNum(n, 2);
const unid = prod => prod.venda === 'un' ? '/un' : '/kg';
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/* ---------- cupons ---------- */
const textoValor = c => c.tipo === '%' ? `${n2(c.valor)}%` : D.reais(Number(c.valor) || 0);
function situacaoCupom(c) {
  if (!c.ativo) return { id: 'off', nome: 'Desativado', cls: '' };
  if (c.validade && c.validade < hoje()) return { id: 'venc', nome: 'Vencido', cls: 'tag-zerado' };
  return { id: 'on', nome: 'Ativo', cls: 'tag-ok' };
}
function descricaoAuto(c) {
  const v = Number(c.valor) || 0;
  let t = c.tipo === '%' ? `${n2(v)}% de desconto no pedido` : `${D.reais(v)} de desconto no pedido`;
  if (c.minimo > 0) t += ` acima de ${D.reais(c.minimo)}`;
  return t;
}
function regrasCupom(c) {
  const r = [];
  if (c.primeiraCompra) r.push('Só na primeira compra');
  if (c.minimo > 0) r.push(`Pedido mínimo ${D.reais(c.minimo)}`);
  if (c.validade) r.push(c.validade < hoje() ? `Venceu em ${ddmm(c.validade)}` : `Válido até ${ddmm(c.validade)}`);
  else r.push('Sem prazo de validade');
  const u = c.usos || 0;
  r.push(u ? `Usado ${u} ${u === 1 ? 'vez' : 'vezes'}` : 'Ainda não usado');
  return r;
}
function mensagemDivulgar(c) {
  const valor = c.tipo === '%' ? `${n2(c.valor)}%` : D.reais(Number(c.valor) || 0);
  let t = `Use o cupom ${c.codigo} ${c.primeiraCompra ? 'na sua primeira encomenda' : 'na sua encomenda'} da Dopira Defumados e ganhe ${valor} de desconto`;
  if (c.minimo > 0) t += ` em pedidos a partir de ${D.reais(c.minimo)}`;
  if (c.validade) t += ` (válido até ${ddmm(c.validade)})`;
  return `${t}. Peça pelo site: ${UI.URL_SITE}`;
}
const ehPadrao = c => c.id === 'c-primeira' || c.codigo.toUpperCase() === 'PRIMEIRACOMPRA';
const cuponsOrdenados = () => {
  const l = D.estado.cupons.slice();
  return l.filter(ehPadrao).concat(l.filter(c => !ehPadrao(c)));
};

function htmlValorStub(c) {
  const v = Number(c.valor) || 0;
  if (c.tipo === '%') {
    const s = n2(v);
    return `<span class="tk-num${s.length > 3 ? ' tk-num-p' : ''}">${esc(s)}<small>%</small></span><span class="tk-xoff">OFF</span>`;
  }
  const s = Number.isInteger(v) ? String(v) : n2(v);
  return `<span class="tk-pre">R$</span><span class="tk-num${s.length > 3 ? ' tk-num-p' : ''}">${esc(s)}</span><span class="tk-xoff">OFF</span>`;
}

function htmlCupom(c) {
  const sit = situacaoCupom(c), dest = ehPadrao(c);
  return `<article class="tk tk-${sit.id}${dest ? ' tk-dest' : ''}" aria-label="Cupom ${esc(c.codigo)}">
    <div class="tk-topo">
      <div class="tk-valor" aria-label="${esc(textoValor(c))} de desconto">${htmlValorStub(c)}</div>
      <div class="tk-corpo">
        <div class="tk-l1">${dest ? '<span class="tk-selo">Cliente novo · padrão</span>' : ''}<span class="pill ${sit.cls}">${sit.nome}</span></div>
        <h4 class="tk-cod">${esc(c.codigo)}</h4>
        <p class="tk-desc">${esc(c.descricao || descricaoAuto(c))}</p>
        <ul class="tk-regras">${regrasCupom(c).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="tk-acoes">
      ${UI.interruptor('sw-c-' + c.id, c.ativo, 'Ativo')}
      <span class="pm-esp"></span>
      <button type="button" class="btn btn-sm btn-1 tk-div" data-acao="divulgar" data-id="${esc(c.id)}">${ICON.compartilhar}Divulgar</button>
      <button type="button" class="btn-ic pm-ic" data-acao="editar-cupom" data-id="${esc(c.id)}" aria-label="Editar cupom ${esc(c.codigo)}" title="Editar">${ICON.editar}</button>
      <button type="button" class="btn-ic pm-ic pm-ic-perigo" data-acao="excluir-cupom" data-id="${esc(c.id)}" aria-label="Excluir cupom ${esc(c.codigo)}" title="Excluir">${ICON.lixo}</button>
    </div>
  </article>`;
}

/* ---------- promoções ---------- */
function situacaoPromo(p) {
  const d = hoje();
  if (!p.ativo) return { id: 'off', nome: 'Desativada', cls: '', ord: 3 };
  if (p.inicio && p.inicio > d) return { id: 'agenda', nome: 'Agendada', cls: 'st-confirmado', ord: 1 };
  if (p.fim && p.fim < d) return { id: 'fim', nome: 'Encerrada', cls: '', ord: 2 };
  return { id: 'on', nome: 'Ativa agora', cls: 'tag-ok', ord: 0 };
}
function periodo(p) {
  if (p.inicio && p.fim) return p.inicio === p.fim ? `só em ${ddmm(p.inicio)}` : `de ${ddmm(p.inicio)} a ${ddmm(p.fim)}`;
  if (p.inicio) return `a partir de ${ddmm(p.inicio)} · sem data de fim`;
  if (p.fim) return `até ${ddmm(p.fim)}`;
  return 'sem data de fim';
}
const produtosDaPromo = p => (!p.produtos || !p.produtos.length) ? D.estado.produtos : p.produtos.map(D.produto).filter(Boolean);
function alvoTexto(p) {
  if (!p.produtos || !p.produtos.length) return 'Todos os produtos';
  const nomes = produtosDaPromo(p).map(x => x.nome);
  if (!nomes.length) return 'Nenhum produto (os escolhidos foram removidos)';
  return nomes.length > 3 ? `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}` : nomes.join(', ').replace(/, ([^,]*)$/, ' e $1');
}
const pct = v => `−${n2(Number(v) || 0)}%`;

function htmlPromo(p) {
  const st = situacaoPromo(p);
  const prods = produtosDaPromo(p);
  const todos = !p.produtos || !p.produtos.length;
  // exemplo de preço (só para promoção que vale agora ou vai valer)
  let ex = '';
  if (st.id === 'on' || st.id === 'agenda') {
    const comPreco = prods.filter(x => x.preco !== null && x.preco !== undefined).slice(0, 2);
    ex = comPreco.map(x => {
      const f = D.arred(x.preco * (1 - Math.max(Number(x.desconto) || 0, Number(p.desconto) || 0) / 100));
      return `<li><span>${esc(x.nome)}</span> <s>${D.reais(x.preco)}</s> <b>${D.reais(f)}${unid(x)}</b></li>`;
    }).join('');
  }
  return `<article class="pm-promo pm-st-${st.id}" aria-label="Promoção ${esc(p.nome)}">
    <div class="pm-promo-topo">
      <div class="pm-pct num">${esc(pct(p.desconto))}</div>
      <div class="pm-promo-info">
        <span class="pill ${st.cls}">${st.nome}</span>
        <h4>${esc(p.nome)}</h4>
        <p class="pm-periodo">${IC.relogio}<span>${esc(periodo(p))}</span></p>
      </div>
    </div>
    <div class="pm-alvo">
      ${todos ? '' : `<span class="pm-minis" aria-hidden="true">${prods.slice(0, 3).map(x => UI.miniatura(x, 28)).join('')}</span>`}
      <span>${esc(alvoTexto(p))}</span>
    </div>
    ${ex ? `<ul class="pm-ex">${ex}</ul>` : ''}
    <div class="pm-acoes">
      ${UI.interruptor('sw-p-' + p.id, p.ativo, 'Ativa')}
      <span class="pm-esp"></span>
      <button type="button" class="btn-ic pm-ic" data-acao="editar-promo" data-id="${esc(p.id)}" aria-label="Editar promoção ${esc(p.nome)}" title="Editar">${ICON.editar}</button>
      <button type="button" class="btn-ic pm-ic pm-ic-perigo" data-acao="excluir-promo" data-id="${esc(p.id)}" aria-label="Excluir promoção ${esc(p.nome)}" title="Excluir">${ICON.lixo}</button>
    </div>
  </article>`;
}

/* ---------- tela ---------- */
function render(params) {
  if (params && (params[0] === 'cupons' || params[0] === 'promocoes')) aba = params[0];
  const E = D.estado;
  const cupons = cuponsOrdenados();
  const promos = E.promocoes.slice().sort((a, b) => situacaoPromo(a).ord - situacaoPromo(b).ord || String(a.inicio || '').localeCompare(String(b.inicio || '')));
  const nAtivas = promos.filter(p => situacaoPromo(p).id === 'on').length;
  const nCupAtivos = cupons.filter(c => situacaoCupom(c).id === 'on').length;

  return `<div class="pm" data-aba="${aba}">
    <header class="cab">
      <div><h2>Promoções</h2><p>Cupons que o cliente digita no site e descontos por período nos produtos.</p></div>
    </header>

    <div class="seg pm-abas" role="radiogroup" aria-label="Mostrar">
      <label><input type="radio" name="pmAba" value="cupons" ${aba === 'cupons' ? 'checked' : ''}><span>Cupons <em class="num">${cupons.length}</em></span></label>
      <label><input type="radio" name="pmAba" value="promocoes" ${aba === 'promocoes' ? 'checked' : ''}><span>Promoções <em class="num">${promos.length}</em></span></label>
    </div>

    <div class="pm-grade">
      <section class="pm-sec" data-sec="cupons" aria-labelledby="pmTitCup">
        <div class="pm-sec-cab">
          <div><h3 id="pmTitCup">Cupons de desconto</h3><p class="muted">${plural(nCupAtivos, 'ativo', 'ativos')} de ${cupons.length}</p></div>
          <button type="button" class="btn btn-3 btn-sm" data-acao="novo-cupom">${ICON.mais}Novo cupom</button>
        </div>
        <p class="pm-explica">${IC.cupom}<span>O cliente digita o cupom no site ao encomendar. O desconto é calculado no pedido, aqui no app.</span></p>
        ${cupons.length ? `<div class="tk-lista">${cupons.map(htmlCupom).join('')}</div>`
          : UI.vazio('Nenhum cupom', 'Crie um cupom para divulgar no WhatsApp e nas redes.', `<button type="button" class="btn btn-1" data-acao="novo-cupom">${ICON.mais}Criar cupom</button>`)}
        <p class="pm-dica">${IC.info}<span>O site reconhece os cupons criados aqui quando é aberto neste mesmo aparelho e navegador. Em outros celulares, por enquanto o site aceita só o <b>PRIMEIRACOMPRA</b>.</span></p>
      </section>

      <section class="pm-sec" data-sec="promocoes" aria-labelledby="pmTitPro">
        <div class="pm-sec-cab">
          <div><h3 id="pmTitPro">Promoções de produtos</h3><p class="muted">${nAtivas ? plural(nAtivas, 'valendo agora', 'valendo agora') : 'Nenhuma valendo agora'}</p></div>
          ${promos.length ? `<button type="button" class="btn btn-3 btn-sm" data-acao="nova-promo">${ICON.mais}Nova promoção</button>` : ''}
        </div>
        <p class="pm-explica">${IC.info}<span>Desconto por período em um, alguns ou todos os produtos. Se o produto já tem desconto próprio, os dois não somam: vale o maior.</span></p>
        ${promos.length ? `<div class="pm-lista">${promos.map(htmlPromo).join('')}</div>`
          : `<div class="pm-vazio">${ICON.promocoes}<h3>Nenhuma promoção ainda</h3><p>Ex.: “Semana da linguiça”, 15% off na linguiça de segunda a domingo. O preço com desconto aparece sozinho no catálogo e nos pedidos.</p><button type="button" class="btn btn-1" data-acao="nova-promo">${ICON.mais}Criar a primeira promoção</button></div>`}
      </section>
    </div>
  </div>`;
}

function montar(el) {
  const raiz = $('.pm', el); if (!raiz) return;
  raiz.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'pmAba') { mudarAba(t.value); raiz.dataset.aba = aba; return; }
    if (t.id && t.id.startsWith('sw-c-')) {
      const c = D.estado.cupons.find(x => x.id === t.id.slice(5)); if (!c) return;
      c.ativo = t.checked; D.salvar();
      UI.toast(`Cupom ${c.codigo} ${c.ativo ? 'ativado' : 'desativado'}`);
      App.redesenhar();
    } else if (t.id && t.id.startsWith('sw-p-')) {
      const p = D.estado.promocoes.find(x => x.id === t.id.slice(5)); if (!p) return;
      p.ativo = t.checked; D.salvar();
      UI.toast(`Promoção ${p.ativo ? 'ativada' : 'desativada'}`);
      App.redesenhar();
    }
  });
  raiz.addEventListener('click', e => {
    const b = e.target.closest('[data-acao]'); if (!b) return;
    const id = b.dataset.id;
    const cupom = id ? D.estado.cupons.find(x => x.id === id) : null;
    const promo = id ? D.estado.promocoes.find(x => x.id === id) : null;
    switch (b.dataset.acao) {
      case 'novo-cupom': return dialogoCupom(null);
      case 'editar-cupom': return cupom && dialogoCupom(cupom);
      case 'excluir-cupom': return cupom && excluirCupom(cupom);
      case 'divulgar': return cupom && divulgar(cupom);
      case 'nova-promo': return dialogoPromo(null);
      case 'editar-promo': return promo && dialogoPromo(promo);
      case 'excluir-promo': return promo && excluirPromo(promo);
    }
  });
}

/* ---------- ações: cupom ---------- */
async function divulgar(c) {
  const txt = mensagemDivulgar(c);
  const sit = situacaoCupom(c);
  if (sit.id !== 'on') UI.toast(`Atenção: o cupom está ${sit.nome.toLowerCase()}`, 'erro');
  if (navigator.share) {
    try { await navigator.share({ title: `Cupom ${c.codigo}`, text: txt }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  UI.copiar(txt, 'Mensagem copiada. É só colar no WhatsApp');
}

async function excluirCupom(c) {
  const extra = ehPadrao(c) ? ' Ele é o cupom padrão de primeira compra: em outros aparelhos o site continua aceitando PRIMEIRACOMPRA.' : '';
  const ok = await UI.confirmar(`Excluir o cupom ${c.codigo}?${extra} Pedidos antigos com esse código deixam de ter o desconto calculado.`, { sim: 'Excluir', perigo: true });
  if (!ok) return;
  D.estado.cupons = D.estado.cupons.filter(x => x !== c);
  D.salvar(); UI.toast(`Cupom ${c.codigo} excluído`); App.redesenhar();
}

/** Marca o campo com erro. A mensagem aparece embaixo depois que a pessoa mexeu no campo ou tentou salvar. */
function marcarErro(inp, msg) {
  inp.setCustomValidity(msg);
  const cp = inp.closest('.campo'); if (!cp) return;
  const mostrar = msg && (inp.dataset.tocado || (inp.form && inp.form.dataset.tentou));
  if (mostrar) cp.dataset.erro = ''; else delete cp.dataset.erro;
  let m = cp.querySelector('.pm-msg-erro');
  if (mostrar) { if (!m) { m = document.createElement('small'); m.className = 'pm-msg-erro'; m.setAttribute('role', 'alert'); cp.appendChild(m); } m.textContent = msg; }
  else if (m) m.remove();
}
/** liga "tocado" nos campos e "tentou" no form ao salvar */
function rastrear(f, d, validar) {
  f.addEventListener('input', e => { if (e.target.dataset) e.target.dataset.tocado = '1'; }, true);
  const salvar = $('.dlg-acoes .btn-1', d);
  if (salvar) salvar.addEventListener('click', () => { f.dataset.tentou = '1'; validar(d); });
}
const limparCodigo = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '');

function dialogoCupom(c) {
  const novo = !c;
  const v = c || { codigo: '', tipo: '%', valor: '', minimo: 0, validade: '', primeiraCompra: false, ativo: true, descricao: '' };
  const html = `<form class="form pm-form" id="fCupom">
    ${UI.campo({ id: 'cpCodigo', rotulo: 'Código do cupom', valor: v.codigo, attrs: 'required maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Ex.: DOMINGO10"', dica: 'Letras e números, sem espaços. É o que o cliente digita.' })}
    <div class="campo"><span class="pm-rot" id="cpTipoRot">Tipo de desconto</span>
      <div class="seg pm-seg" role="radiogroup" aria-labelledby="cpTipoRot">
        <label><input type="radio" name="cpTipo" value="%" ${v.tipo !== 'R$' ? 'checked' : ''}><span>% do pedido</span></label>
        <label><input type="radio" name="cpTipo" value="R$" ${v.tipo === 'R$' ? 'checked' : ''}><span>Valor fixo (R$)</span></label>
      </div>
    </div>
    <div class="form-2">
      ${UI.campo({ id: 'cpValor', rotulo: 'Desconto', valor: D.paraInput(v.valor === '' ? null : Number(v.valor), 2), attrs: 'required inputmode="decimal" autocomplete="off"', sufixo: v.tipo === 'R$' ? 'R$' : '%' })}
      ${UI.campo({ id: 'cpMinimo', rotulo: 'Pedido mínimo', valor: v.minimo > 0 ? D.paraInput(v.minimo, 2) : '', attrs: 'inputmode="decimal" autocomplete="off" placeholder="Opcional"', sufixo: 'R$' })}
    </div>
    ${UI.campo({ id: 'cpValidade', rotulo: 'Válido até', tipo: 'date', valor: v.validade || '', dica: 'Deixe vazio para não ter prazo.' })}
    <div class="pm-sws">
      ${UI.interruptor('cpPrimeira', v.primeiraCompra, 'Só na primeira compra do cliente')}
      ${UI.interruptor('cpAtivo', v.ativo, 'Cupom ativo')}
    </div>
    ${UI.campo({ id: 'cpDesc', rotulo: 'Descrição (opcional)', valor: (c && c.descricao !== descricaoAuto(c)) ? c.descricao : '', attrs: 'maxlength="80" autocomplete="off"', dica: 'Se ficar vazio, usamos o texto sugerido no campo.' })}
  </form>`;

  let dados = null;
  const ler = d => {
    const tipo = $('input[name="cpTipo"]:checked', d).value;
    return {
      codigo: limparCodigo($('#cpCodigo', d).value), tipo,
      valor: D.num($('#cpValor', d).value), minimo: D.num($('#cpMinimo', d).value),
      validade: $('#cpValidade', d).value || '', primeiraCompra: $('#cpPrimeira', d).checked,
      ativo: $('#cpAtivo', d).checked, descricao: $('#cpDesc', d).value.trim()
    };
  };
  const validar = d => {
    const x = ler(d);
    const cod = $('#cpCodigo', d);
    marcarErro(cod, !x.codigo ? 'Informe o código do cupom.'
      : !/^[A-Z0-9_-]+$/.test(x.codigo) ? 'Use só letras, números, hífen ou sublinhado.'
      : D.estado.cupons.some(o => o !== c && o.codigo.toUpperCase() === x.codigo) ? `Já existe um cupom ${x.codigo}. Escolha outro código.` : '');
    marcarErro($('#cpValor', d), x.valor === null || x.valor <= 0 ? 'Informe um desconto maior que zero.'
      : (x.tipo === '%' && x.valor > 100) ? 'Em porcentagem, o máximo é 100%.' : '');
    const minTxt = $('#cpMinimo', d).value.trim();
    marcarErro($('#cpMinimo', d), minTxt && (x.minimo === null || x.minimo < 0) ? 'Valor inválido.' : '');
    $('#cpDesc', d).placeholder = x.valor > 0 ? descricaoAuto({ ...x, minimo: x.minimo || 0 }) : 'Ex.: 20% de desconto no pedido';
    return x;
  };

  UI.abrirDialogo({
    titulo: novo ? 'Novo cupom' : 'Editar cupom', html,
    botoes: [
      { texto: 'Cancelar', classe: 'btn-2', valor: null },
      { texto: 'Salvar', classe: 'btn-1', valor: 'ok', antes: d => { dados = validar(d); return $('form', d).reportValidity(); } }
    ],
    montar: d => {
      const f = $('form', d); rastrear(f, d, validar);
      const cod = $('#cpCodigo', d);
      cod.addEventListener('input', () => {
        const p = cod.selectionStart, antes = cod.value.length, novoV = limparCodigo(cod.value);
        if (novoV !== cod.value) { cod.value = novoV; const q = Math.max(0, p - (antes - novoV.length)); try { cod.setSelectionRange(q, q); } catch (e) {} }
      });
      f.addEventListener('input', () => validar(d));
      f.addEventListener('change', e => {
        if (e.target.name === 'cpTipo') $('#cpValor', d).closest('.campo-in').querySelector('.suf').textContent = e.target.value === 'R$' ? 'R$' : '%';
        validar(d);
      });
      validar(d);
    }
  }).then(r => {
    if (r !== 'ok' || !dados) return;
    const obj = {
      codigo: dados.codigo, tipo: dados.tipo, valor: D.arred(dados.valor), minimo: dados.minimo > 0 ? D.arred(dados.minimo) : 0,
      validade: dados.validade, primeiraCompra: dados.primeiraCompra, ativo: dados.ativo
    };
    obj.descricao = dados.descricao || descricaoAuto(obj);
    if (novo) D.estado.cupons.push({ id: D.novoId('c'), usos: 0, ...obj });
    else Object.assign(c, obj);
    D.salvar();
    UI.toast(novo ? `Cupom ${obj.codigo} criado` : `Cupom ${obj.codigo} salvo`);
    mudarAba('cupons');
    App.redesenhar();
  });
}

/* ---------- ações: promoção ---------- */
async function excluirPromo(p) {
  const ok = await UI.confirmar(`Excluir a promoção “${p.nome}”? Os preços voltam ao normal.`, { sim: 'Excluir', perigo: true });
  if (!ok) return;
  D.estado.promocoes = D.estado.promocoes.filter(x => x !== p);
  D.salvar(); UI.toast('Promoção excluída'); App.redesenhar();
}

function dialogoPromo(p) {
  const novo = !p;
  const v = p || { nome: '', desconto: '', produtos: [], inicio: hoje(), fim: '', ativo: true };
  const todos = !v.produtos || !v.produtos.length;
  const prods = D.estado.produtos;
  const html = `<form class="form pm-form" id="fPromo">
    ${UI.campo({ id: 'prNome', rotulo: 'Nome da promoção', valor: v.nome, attrs: 'required maxlength="60" autocomplete="off" placeholder="Ex.: Semana da linguiça"' })}
    <div class="pm-curto">${UI.campo({ id: 'prDesc', rotulo: 'Desconto', valor: v.desconto === '' ? '' : D.paraInput(Number(v.desconto), 2), attrs: 'required inputmode="decimal" autocomplete="off" placeholder="Ex.: 15"', sufixo: '%' })}</div>
    <div class="form-2">
      ${UI.campo({ id: 'prInicio', rotulo: 'Começa em', tipo: 'date', valor: v.inicio || '', attrs: 'required' })}
      ${UI.campo({ id: 'prFim', rotulo: 'Termina em', tipo: 'date', valor: v.fim || '', dica: 'Vazio = sem data de fim' })}
    </div>
    <fieldset class="pm-fs">
      <legend class="pm-rot">Produtos na promoção</legend>
      <div class="seg pm-seg" role="radiogroup" aria-label="Quais produtos">
        <label><input type="radio" name="prAlvo" value="todos" ${todos ? 'checked' : ''}><span>Todos os produtos</span></label>
        <label><input type="radio" name="prAlvo" value="alguns" ${!todos ? 'checked' : ''}><span>Escolher</span></label>
      </div>
      <div class="pm-prods" id="prProds" ${todos ? 'hidden' : ''}>
        ${prods.map(x => `<label class="pm-prod">
          <input type="checkbox" name="prProd" value="${esc(x.id)}" ${!todos && v.produtos.includes(x.id) ? 'checked' : ''}>
          ${UI.miniatura(x, 40)}
          <span class="pm-prod-t"><b>${esc(x.nome)}</b><small>${x.preco === null || x.preco === undefined ? 'Definir preço' : esc(D.reais(x.preco) + unid(x))}${Number(x.desconto) > 0 ? ` · já tem ${esc(n2(x.desconto))}% off` : ''}</small></span>
          <span class="pm-check" aria-hidden="true">${ICON.check}</span>
        </label>`).join('')}
      </div>
      <p class="pm-msg-erro" id="prProdErro" role="alert" hidden>Escolha pelo menos um produto.</p>
    </fieldset>
    <div class="pm-previa" aria-live="polite">
      <h4>Como fica o preço</h4>
      <div id="prPrevia"></div>
      <p class="pm-regra">${IC.info}<span>O desconto do produto e o da promoção não somam: vale o maior.</span></p>
    </div>
    ${UI.interruptor('prAtivo', v.ativo, 'Promoção ativa')}
  </form>`;

  let dados = null;
  const ler = d => ({
    nome: $('#prNome', d).value.trim(),
    desconto: D.num($('#prDesc', d).value),
    inicio: $('#prInicio', d).value || '', fim: $('#prFim', d).value || '',
    todos: $('input[name="prAlvo"]:checked', d).value === 'todos',
    produtos: $$('input[name="prProd"]:checked', d).map(i => i.value),
    ativo: $('#prAtivo', d).checked
  });
  const previa = (d, x) => {
    const alvo = x.todos ? prods : prods.filter(pp => x.produtos.includes(pp.id));
    const box = $('#prPrevia', d);
    if (!alvo.length) { box.innerHTML = '<p class="muted pm-previa-vazia">Escolha os produtos para ver os preços.</p>'; return; }
    const okDesc = x.desconto !== null && x.desconto > 0 && x.desconto <= 100;
    box.innerHTML = `<ul class="pm-previa-l">${alvo.map(pp => {
      let dir;
      if (pp.preco === null || pp.preco === undefined) dir = '<span class="pm-sem">Definir preço</span>';
      else if (!okDesc) dir = `<span class="num">${D.reais(pp.preco)}${unid(pp)}</span>`;
      else {
        const dp = Number(pp.desconto) || 0, vale = Math.max(dp, x.desconto);
        const f = D.arred(pp.preco * (1 - vale / 100));
        dir = `<span class="pm-de">${D.reais(pp.preco)}</span><span class="pm-seta" aria-label="passa para">→</span><b class="num">${D.reais(f)}</b><small>${unid(pp)}</small>`
          + (dp >= x.desconto && dp > 0 ? `<em class="pm-nota">vale o desconto do produto (${n2(dp)}%)</em>` : '');
      }
      return `<li><span class="pm-pn">${esc(pp.nome)}</span><span class="pm-pv">${dir}</span></li>`;
    }).join('')}</ul>`;
  };
  const validar = d => {
    const x = ler(d);
    marcarErro($('#prNome', d), x.nome ? '' : 'Dê um nome para a promoção.');
    marcarErro($('#prDesc', d), x.desconto === null || x.desconto <= 0 ? 'Informe um desconto maior que zero.' : x.desconto > 100 ? 'O máximo é 100%.' : '');
    marcarErro($('#prFim', d), x.fim && x.inicio && x.fim < x.inicio ? 'A data de fim precisa ser igual ou depois do início.' : '');
    const primeiro = $('input[name="prProd"]', d);
    const semProd = !x.todos && !x.produtos.length;
    if (primeiro) primeiro.setCustomValidity(semProd ? 'Escolha pelo menos um produto.' : '');
    $('#prProdErro', d).hidden = !(semProd && $('form', d).dataset.tentou);
    $('#prProds', d).hidden = x.todos;
    previa(d, x);
    return x;
  };

  UI.abrirDialogo({
    titulo: novo ? 'Nova promoção' : 'Editar promoção', html,
    botoes: [
      { texto: 'Cancelar', classe: 'btn-2', valor: null },
      { texto: 'Salvar', classe: 'btn-1', valor: 'ok', antes: d => { dados = validar(d); return $('form', d).reportValidity(); } }
    ],
    montar: d => {
      const f = $('form', d); rastrear(f, d, validar);
      f.addEventListener('input', () => validar(d));
      f.addEventListener('change', () => validar(d));
      validar(d);
    }
  }).then(r => {
    if (r !== 'ok' || !dados) return;
    const obj = {
      nome: dados.nome, desconto: D.arred(dados.desconto), inicio: dados.inicio, fim: dados.fim,
      produtos: dados.todos ? [] : dados.produtos, ativo: dados.ativo
    };
    if (novo) D.estado.promocoes.push({ id: D.novoId('pr'), ...obj });
    else Object.assign(p, obj);
    D.salvar();
    const st = situacaoPromo(novo ? obj : p);
    UI.toast(`${novo ? 'Promoção criada' : 'Promoção salva'} · ${st.nome.toLowerCase()}`);
    mudarAba('promocoes');
    App.redesenhar();
  });
}

TELAS['promocoes'] = { titulo: 'Promoções', nav: 'promocoes', render, montar };
})();
