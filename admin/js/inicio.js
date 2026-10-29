/* =====================================================================
   Sistema Dopira · Início (painel do dia)
   Saudação, primeiros passos, indicadores, produção do domingo,
   previsão do tempo (Open-Meteo, com cache de 1 h), atalho para o site
   e últimos pedidos.
   ===================================================================== */
(function () {
'use strict';
const { $, esc, ICON } = UI;
window.TELAS = window.TELAS || {};

/* ---------- utilidades locais ---------- */
const plural = (n, um, varios) => `${D.fmtNum(n, 3)} ${n === 1 ? um : varios}`;
const ativos = () => D.estado.pedidos.filter(p => p.status !== 'cancelado');
const doDomingo = dom => ativos().filter(p => p.domingo === dom);
const hhmm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ehStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
const svgPeq = d => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  gota:     svgPeq('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>'),
  vento:    svgPeq('<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>'),
  termo:    svgPeq('<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z"/>'),
  atualizar:svgPeq('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
  ok:       svgPeq('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>')
};

function saudacao() {
  const h = new Date().getHours();
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
function dataExtenso() {
  const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- produção do domingo ---------- */
/* Soma por produto os itens dos pedidos (não cancelados) do domingo.
   "pendente" = o que ainda NÃO saiu do estoque (pedidos que não deram baixa);
   é isso que se compara com o estoque atual. */
function producao(dom) {
  const mapa = new Map();
  doDomingo(dom).forEach(ped => ped.itens.forEach(it => {
    const prod = D.produto(it.prod); if (!prod) return;
    let l = mapa.get(prod.id);
    if (!l) { l = { prod, qtd: 0, kg: 0, kgOk: true, estimado: false, pendQtd: 0, pendKg: 0, pendOk: true, pedidos: new Set() }; mapa.set(prod.id, l); }
    const q = Number(it.qtd) || 0;
    let kg = null, est = false;
    if (prod.venda === 'kg') {
      if (it.peso > 0) kg = it.peso;
      else if (prod.pesoMedio > 0) { kg = q * prod.pesoMedio; est = true; }
    }
    l.qtd += q; l.pedidos.add(ped.id);
    // venda por unidade com peso aproximado (ex.: panceta ≈500 g): entra no total de kg como aproximado
    if (prod.venda === 'un' && prod.pesoAprox > 0) { l.kg += q * prod.pesoAprox; l.estimado = true; }
    if (prod.venda === 'kg') { if (kg === null) l.kgOk = false; else l.kg += kg; if (est) l.estimado = true; }
    if (!ped.baixado) {
      l.pendQtd += q;
      if (prod.venda === 'kg') { if (kg === null) l.pendOk = false; else l.pendKg += kg; }
    }
  }));
  return [...mapa.values()].sort((a, b) => a.prod.nome.localeCompare(b.prod.nome, 'pt-BR'));
}

function htmlProducao(dom) {
  const linhas = producao(dom);
  const peds = doDomingo(dom);
  if (!linhas.length) {
    return `<div class="card ini-prod-vazio">${ICON.fogo}<div><b>Nenhum pedido para domingo ainda</b><span>Quando entrarem encomendas para ${esc(D.fmtData(dom))}, aqui aparece quanto defumar de cada produto.</span></div></div>`;
  }
  const temKg = l => (l.prod.venda === 'kg' && l.kgOk) || (l.prod.venda === 'un' && l.prod.pesoAprox > 0);
  const kgTotal = linhas.reduce((s, l) => s + (temKg(l) ? l.kg : 0), 0);
  const algumEst = linhas.some(l => l.estimado);
  const faltando = linhas.filter(l => falta(l) > 0).length;
  const itens = linhas.map(l => {
    const p = l.prod, kg = p.venda === 'kg';
    const qt = kg
      ? `${plural(l.qtd, 'peça', 'peças')} · ${l.kgOk ? `${l.estimado ? '≈ ' : ''}${D.fmtNum(D.arred(l.kg, 2), 2)} kg` : 'peso a definir'}`
      : p.pesoAprox > 0 ? `${D.fmtNum(l.qtd, 0)} un · ≈ ${D.fmtPeso(D.arred(l.kg, 3))}`
      : plural(l.qtd, 'unidade', 'unidades');
    const est = Math.max(0, p.estoque || 0);
    const f = falta(l);
    let fim;
    if (kg && !l.pendOk) fim = `<span class="ini-est">estoque ${esc(D.qtd(est, p.venda))}</span><span class="ini-aviso">defina o peso médio</span>`;
    else if (f > 0) fim = `<span class="ini-est">estoque ${esc(D.qtd(est, p.venda))}</span><span class="ini-falta">faltam ${esc(D.qtd(D.arred(f, 3), p.venda))}</span>`;
    else fim = `<span class="ini-est">estoque ${esc(D.qtd(est, p.venda))}</span><span class="ini-ok">${IC.ok} dá conta</span>`;
    return `<li class="ini-prod${f > 0 ? ' tem-falta' : ''}">
      ${UI.miniatura(p, 44)}
      <div class="meio"><b>${esc(p.nome)}</b><span>${esc(qt)}</span></div>
      <div class="fim">${fim}</div>
    </li>`;
  }).join('');
  return `<div class="card ini-prod-card">
    <div class="ini-prod-resumo">
      <div><span class="num">${kgTotal > 0 ? `${algumEst ? '≈ ' : ''}${esc(D.fmtNum(D.arred(kgTotal, 1), 1))} kg` : esc(String(linhas.length))}</span>
      <small>${kgTotal > 0 ? 'de carne para defumar' : 'produtos'} · ${plural(peds.length, 'pedido', 'pedidos')}</small></div>
      ${faltando ? `<span class="pill tag-zerado">${faltando === 1 ? '1 item em falta' : `${faltando} itens em falta`}</span>` : '<span class="pill tag-ok">Estoque cobre</span>'}
    </div>
    <ul class="ini-prod-lista">${itens}</ul>
    <p class="ini-nota">${algumEst ? '≈ = estimado pelo peso médio (ou peso aproximado da unidade). ' : ''}Pedidos já confirmados saíram do estoque; a falta considera só os que ainda não deram baixa.</p>
  </div>`;
}
function falta(l) {
  if (l.prod.venda === 'kg') { if (!l.pendOk) return 0; return D.arred(l.pendKg - Math.max(0, l.prod.estoque || 0), 3); }
  return l.pendQtd - Math.max(0, l.prod.estoque || 0);
}

/* =====================================================================
   PREVISÃO DO TEMPO · Open-Meteo (grátis, sem chave)
   ===================================================================== */
const TEMPO_URL = 'https://api.open-meteo.com/v1/forecast?latitude=-22.2756&longitude=-51.5006&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=America%2FSao_Paulo&forecast_days=7';
const TEMPO_CHAVE = 'dopira-admin-tempo';
const UMA_HORA = 3600e3;
let tempoMemoria = null;   // caso o localStorage esteja bloqueado
let buscando = null;

function lerCache() {
  try {
    const c = JSON.parse(localStorage.getItem(TEMPO_CHAVE) || 'null');
    if (valido(c)) return c;
  } catch (e) {}
  return valido(tempoMemoria) ? tempoMemoria : null;
}
function valido(c) { return !!(c && c.t && c.dados && c.dados.current && c.dados.daily && Array.isArray(c.dados.daily.time)); }
function gravarCache(dados) {
  tempoMemoria = { t: Date.now(), dados };
  try { localStorage.setItem(TEMPO_CHAVE, JSON.stringify(tempoMemoria)); } catch (e) {}
}
async function buscarTempo() {
  const ctl = 'AbortController' in window ? new AbortController() : null;
  const to = setTimeout(() => ctl && ctl.abort(), 12000);
  try {
    const r = await fetch(TEMPO_URL, ctl ? { signal: ctl.signal } : {});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (!j || !j.current || !j.daily || !Array.isArray(j.daily.time)) throw new Error('Resposta inesperada');
    gravarCache(j);
    return j;
  } finally { clearTimeout(to); }
}

/* Código WMO → condição em português + ícone */
function condicao(code, dia = true) {
  const c = Number(code);
  if (c === 0) return { nome: dia ? 'Céu limpo' : 'Céu limpo', ic: dia ? 'sol' : 'lua' };
  if (c === 1 || c === 2) return { nome: c === 1 ? 'Poucas nuvens' : 'Parcialmente nublado', ic: dia ? 'solNuvem' : 'luaNuvem' };
  if (c === 3) return { nome: 'Nublado', ic: 'nublado' };
  if (c === 45 || c === 48) return { nome: 'Neblina', ic: 'neblina' };
  if (c >= 51 && c <= 57) return { nome: 'Garoa', ic: 'garoa' };
  if (c >= 61 && c <= 67) return { nome: c === 61 ? 'Chuva fraca' : c >= 65 ? 'Chuva forte' : 'Chuva', ic: 'chuva' };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { nome: 'Neve', ic: 'neve' };
  if (c >= 80 && c <= 82) return { nome: c === 82 ? 'Pancadas fortes' : 'Pancadas de chuva', ic: dia ? 'pancadas' : 'pancadasNoite' };
  if (c >= 95 && c <= 99) return { nome: 'Tempestade', ic: 'tempestade' };
  return { nome: 'Sem informação', ic: 'nublado' };
}

/* Ícones de tempo desenhados à mão (viewBox 64×64, cores da marca) */
const COR = { sol: '#F8C505', raio: '#F07C2B', nuvem: '#EDEBE6', nuvem2: '#B9B4AA', nuvemEsc: '#8C857B', agua: '#7FB6E6', lua: '#F3E9C8' };
const nuvem = (dx = 0, dy = 0, cor = COR.nuvem, s = 1) =>
  `<path transform="translate(${dx} ${dy}) scale(${s})" d="M19 48h28a10 10 0 0 0 1.2-19.9A15 15 0 0 0 19.6 24 12 12 0 0 0 19 48Z" fill="${cor}"/>`;
const sol = (cx, cy, r) => {
  let raios = '';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r1 = r + 4, r2 = r + 9;
    raios += `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}"/>`;
  }
  return `<g stroke="${COR.sol}" stroke-width="3.2" stroke-linecap="round">${raios}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${COR.sol}"/><circle cx="${cx - r * .3}" cy="${cy - r * .3}" r="${r * .45}" fill="#fff" opacity=".28"/>`;
};
const lua = (cx, cy, r) => `<path d="M${cx + r * .35} ${cy - r}A${r} ${r} 0 1 0 ${cx + r} ${cy + r * .45} ${r * .78} ${r * .78} 0 0 1 ${cx + r * .35} ${cy - r}Z" fill="${COR.lua}"/>`;
const gotas = (pts, len = 7) => `<g stroke="${COR.agua}" stroke-width="3" stroke-linecap="round">${pts.map(([x, y]) => `<line x1="${x}" y1="${y}" x2="${x - 2.5}" y2="${y + len}"/>`).join('')}</g>`;
const DESENHO = {
  sol:        () => sol(32, 32, 11),
  lua:        () => lua(30, 32, 15) + `<circle cx="47" cy="17" r="1.6" fill="${COR.lua}"/><circle cx="51" cy="29" r="1.1" fill="${COR.lua}"/>`,
  solNuvem:   () => sol(24, 22, 9) + nuvem(4, 4),
  luaNuvem:   () => lua(24, 22, 11) + nuvem(4, 4),
  nublado:    () => nuvem(10, -6, COR.nuvem2, .85) + nuvem(0, 2),
  neblina:    () => nuvem(0, -6) + `<g stroke="${COR.nuvem2}" stroke-width="3.2" stroke-linecap="round"><line x1="12" y1="48" x2="46" y2="48"/><line x1="18" y1="55" x2="52" y2="55"/></g>`,
  garoa:      () => nuvem(0, -8) + `<g fill="${COR.agua}"><circle cx="22" cy="49" r="2.2"/><circle cx="32" cy="54" r="2.2"/><circle cx="42" cy="49" r="2.2"/><circle cx="27" cy="59" r="2"/><circle cx="38" cy="60" r="2"/></g>`,
  chuva:      () => nuvem(0, -8, COR.nuvem2) + gotas([[22, 46], [32, 46], [42, 46], [27, 55], [37, 55]]),
  pancadas:   () => sol(22, 18, 8) + nuvem(4, -2) + gotas([[28, 52], [38, 52], [48, 52]], 8),
  pancadasNoite: () => lua(22, 18, 10) + nuvem(4, -2) + gotas([[28, 52], [38, 52], [48, 52]], 8),
  tempestade: () => nuvem(0, -8, COR.nuvemEsc) + `<path d="M34 40 26 52h7l-4 10 12-14h-7l4-8Z" fill="${COR.sol}" stroke="${COR.raio}" stroke-width="1.2" stroke-linejoin="round"/>` + gotas([[20, 46], [46, 46]], 6),
  neve:       () => nuvem(0, -8) + `<g stroke="#fff" stroke-width="2.4" stroke-linecap="round">${[[22, 50], [34, 55], [45, 49]].map(([x, y]) => `<path d="M${x - 4} ${y}h8M${x} ${y - 4}v8M${x - 3} ${y - 3}l6 6M${x + 3} ${y - 3}l-6 6"/>`).join('')}</g>`
};
function iconeTempo(ic, cls = '') {
  return `<svg class="tp-svg ${cls}" viewBox="0 0 64 64" aria-hidden="true">${(DESENHO[ic] || DESENHO.nublado)()}</svg>`;
}

function dicas(d) {
  const t = d.daily, lista = [];
  const idx = dia => t.time.findIndex(iso => D.dataDeISO(iso).getDay() === dia);
  const sab = idx(6), dom = idx(0);
  const v = (arr, i) => (arr && i >= 0 && arr[i] !== null && arr[i] !== undefined) ? Number(arr[i]) : null;
  const chSab = v(t.precipitation_probability_max, sab), chDom = v(t.precipitation_probability_max, dom);
  const vSab = v(t.wind_speed_10m_max, sab), vDom = v(t.wind_speed_10m_max, dom);
  const maxDom = v(t.temperature_2m_max, dom);
  if (chSab !== null && chSab >= 60) lista.push({ tipo: 'chuva', txt: `Chuva prevista no sábado (${Math.round(chSab)}%): proteja a lenha e o defumador.` });
  const vento = Math.max(vSab ?? 0, vDom ?? 0);
  if (vento >= 30) lista.push({ tipo: 'vento', txt: `Vento forte no ${vSab !== null && vSab >= 30 ? 'sábado' : 'domingo'} (até ${Math.round(vento)} km/h): o fogo fica mais difícil de controlar.` });
  if (maxDom !== null && maxDom >= 32) lista.push({ tipo: 'calor', txt: `Domingo quente (${Math.round(maxDom)} °C): leve as entregas em caixa térmica.` });
  if (chDom !== null && chDom >= 60) lista.push({ tipo: 'chuva', txt: `Chuva no domingo (${Math.round(chDom)}%): embale bem as entregas e combine horários.` });
  if (!lista.length) lista.push({ tipo: 'bom', txt: 'Tempo bom para defumar no fim de semana.' });
  return lista.slice(0, 2);
}

function htmlTempo(c, { atualizando = false, erro = false } = {}) {
  const d = c.dados, a = d.current, t = d.daily;
  const dia = a.is_day === undefined ? true : Number(a.is_day) === 1;
  const cond = condicao(a.weather_code, dia);
  const r = n => (n === null || n === undefined || !isFinite(n)) ? '—' : Math.round(n);
  const hoje = D.hojeISO();
  const dias = t.time.slice(0, 7).map((iso, i) => {
    const dt = D.dataDeISO(iso), wd = dt.getDay();
    const cd = condicao(t.weather_code[i], true);
    const marca = wd === 0 ? 'dom' : wd === 6 ? 'sab' : '';
    const nomeDia = iso === hoje ? 'Hoje' : D.DIAS[wd].slice(0, 3).replace(/^./, s => s.toUpperCase());
    const ch = t.precipitation_probability_max ? t.precipitation_probability_max[i] : null;
    return `<li class="tp-dia"${marca ? ` data-marca="${marca}"` : ''}>
      ${marca ? `<em class="tp-tag">${marca === 'dom' ? 'Entrega' : 'Defumar'}</em>` : '<em class="tp-tag tp-tag-vz" aria-hidden="true">&nbsp;</em>'}
      <b>${nomeDia}</b><small>${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}</small>
      ${iconeTempo(cd.ic, 'tp-svg-p')}<span class="sr">${esc(cd.nome)}.</span>
      <span class="tp-mx"><span class="sr">máxima </span>${r(t.temperature_2m_max[i])}°</span>
      <span class="tp-mn"><span class="sr">mínima </span>${r(t.temperature_2m_min[i])}°</span>
      <span class="tp-ch${ch >= 60 ? ' alto' : ''}">${IC.gota}<span class="sr">chance de chuva </span>${r(ch)}%</span>
    </li>`;
  }).join('');
  const dc = dicas(d).map(x => `<li data-tipo="${x.tipo}">${x.tipo === 'vento' ? IC.vento : x.tipo === 'chuva' ? IC.gota : x.tipo === 'calor' ? IC.termo : x.tipo === 'bom' ? ICON.fogo : ICON.alerta}<span>${esc(x.txt)}</span></li>`).join('');
  return `<div class="tp ${dia ? 'tp-dia-cl' : 'tp-noite'}">
    <div class="tp-topo">
      <h3><span>Tempo em</span> Pirapozinho</h3>
      <button type="button" class="btn-ic tp-atu${atualizando ? ' girando' : ''}" data-tempo-atualizar aria-label="Atualizar a previsão" title="Atualizar">${IC.atualizar}</button>
    </div>
    ${erro ? `<p class="tp-erro" role="status">${ICON.alerta}<span>Sem conexão agora. Mostrando a previsão de ${esc(D.fmtDataHora(new Date(c.t).toISOString()))}.</span></p>` : ''}
    <div class="tp-agora">
      ${iconeTempo(cond.ic, 'tp-svg-g')}
      <div class="tp-graus">
        <div class="tp-temp num">${r(a.temperature_2m)}<sup>°C</sup></div>
        <div class="tp-cond">${esc(cond.nome)}</div>
      </div>
    </div>
    <dl class="tp-det">
      <div>${IC.termo}<dt>Sensação</dt><dd>${r(a.apparent_temperature)}°</dd></div>
      <div>${IC.gota}<dt>Umidade</dt><dd>${r(a.relative_humidity_2m)}%</dd></div>
      <div>${IC.vento}<dt>Vento</dt><dd>${r(a.wind_speed_10m)} km/h</dd></div>
    </dl>
    <ol class="tp-dias" aria-label="Próximos 7 dias" tabindex="0">${dias}</ol>
    <ul class="tp-dicas" aria-label="Dicas para o fim de semana">${dc}</ul>
    <p class="tp-rodape"><span>${atualizando ? 'Atualizando…' : `Atualizado às ${hhmm(c.t)}`}</span><span>Dados: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></span></p>
  </div>`;
}
function htmlTempoEsqueleto() {
  return `<div class="tp tp-dia-cl tp-esq" aria-busy="true" aria-label="Carregando a previsão do tempo">
    <div class="tp-topo"><h3><span>Tempo em</span> Pirapozinho</h3></div>
    <div class="tp-agora"><i class="esq esq-c"></i><div class="tp-graus"><i class="esq esq-l"></i><i class="esq esq-m"></i></div></div>
    <div class="tp-det-esq"><i class="esq"></i><i class="esq"></i><i class="esq"></i></div>
    <div class="tp-dias">${'<i class="esq esq-dia"></i>'.repeat(7)}</div>
    <p class="tp-rodape"><span>Buscando a previsão…</span></p>
  </div>`;
}
function htmlTempoErro() {
  return `<div class="tp tp-dia-cl tp-falhou">
    <div class="tp-topo"><h3><span>Tempo em</span> Pirapozinho</h3></div>
    <div class="tp-falhou-c">${iconeTempo('nublado', 'tp-svg-g')}
      <p><b>Não deu para carregar a previsão.</b><span>Verifique a internet e tente de novo.</span></p>
      <button type="button" class="btn btn-1 btn-sm" data-tempo-atualizar>${IC.atualizar} Tentar de novo</button>
    </div>
    <p class="tp-rodape"><span></span><span>Dados: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></span></p>
  </div>`;
}
function htmlTempoInicial() {
  const c = lerCache();
  return c ? htmlTempo(c) : htmlTempoEsqueleto();
}
/** Busca (se precisar) e redesenha SÓ o bloco do tempo. */
function atualizarTempo(forcar) {
  const box = document.getElementById('tempo'); if (!box) return;
  const c = lerCache();
  if (c && !forcar && Date.now() - c.t < UMA_HORA) return;   // cache fresco: já está na tela
  box.innerHTML = c ? htmlTempo(c, { atualizando: true }) : htmlTempoEsqueleto();
  if (!buscando) buscando = buscarTempo().finally(() => { buscando = null; });
  buscando.then(() => {
    const b = document.getElementById('tempo'); const n = lerCache();
    if (b && n) b.innerHTML = htmlTempo(n);
    if (forcar) UI.toast('Previsão atualizada');
  }, () => {
    const b = document.getElementById('tempo'); if (!b) return;
    const n = lerCache();
    b.innerHTML = n ? htmlTempo(n, { erro: true }) : htmlTempoErro();
    if (forcar) UI.toast('Não foi possível atualizar a previsão', 'erro');
  });
}

/* =====================================================================
   TELA
   ===================================================================== */
function render() {
  const est = D.estado;
  const dom = D.proximoDomingo();
  const semPrecos = !est.produtos.some(p => p.preco !== null && p.preco !== undefined);
  const novos = est.pedidos.filter(p => p.status === 'novo').length;
  const pedsDom = doDomingo(dom);
  let totDom = 0, incompleto = false;
  pedsDom.forEach(p => { const t = D.totais(p); totDom += t.total; if (!t.completo) incompleto = true; });
  const prodsAtivos = est.produtos.filter(p => p.ativo);
  const zerados = prodsAtivos.filter(p => D.situacaoEstoque(p) === 'zerado').length;
  const baixos = prodsAtivos.filter(p => D.situacaoEstoque(p) === 'baixo').length;
  const mes = D.hojeISO().slice(0, 7);
  const entreguesMes = est.pedidos.filter(p => p.status === 'entregue' && (p.domingo || '').slice(0, 7) === mes);
  const fat = entreguesMes.reduce((s, p) => s + D.totais(p).total, 0);
  const nomeMes = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  const domCurto = D.fmtData(dom).replace(/^dom, /, '');
  const hojeDom = dom === D.hojeISO();

  const ultimos = [...est.pedidos].sort((a, b) => (b.criado || '').localeCompare(a.criado || '')).slice(0, 5);

  const passos = semPrecos && !est.exemplo ? `
    <section class="card ini-passos" aria-labelledby="tPassos">
      <div class="ini-passos-cab">
        <span class="ini-passos-ic">${ICON.fogo}</span>
        <div><h3 id="tPassos">Primeiros passos</h3><p>Três coisas para deixar o app pronto para as encomendas.</p></div>
      </div>
      <ol class="ini-passos-lista">
        <li><a href="#/catalogo"><span class="n">1</span><span class="t"><b>Defina preços e estoque</b><small>Preço por kg ou unidade, peso médio das peças e quanto tem pronto.</small></span>${ICON.seta}</a></li>
        <li><a href="#/promocoes"><span class="n">2</span><span class="t"><b>Confira o cupom PRIMEIRACOMPRA</b><small>20% no primeiro pedido de cada cliente. Ajuste se quiser.</small></span>${ICON.seta}</a></li>
        <li>${ehStandalone()
          ? `<div class="feito"><span class="n">${ICON.check}</span><span class="t"><b>App instalado</b><small>Ele já abre direto da tela inicial.</small></span></div>`
          : `<button type="button" data-instalar><span class="n">3</span><span class="t"><b>Instale o app no celular</b><small>Fica com ícone na tela inicial, como um aplicativo.</small></span>${ICON.seta}</button>`}</li>
      </ol>
      <div class="ini-passos-ex">
        <p>Quer ver como fica antes? Carregue pedidos e preços de mentira para testar.</p>
        <button type="button" class="btn btn-2 btn-sm" data-exemplo>Testar com dados de exemplo (fictícios)</button>
      </div>
    </section>` : '';

  const stats = `
    <div class="stats ini-stats">
      <a class="stat" href="#/pedidos"${novos ? ' data-alerta' : ''}>
        <span class="rot">Pedidos novos</span><span class="val">${novos}</span>
        <span class="sub">${novos ? 'aguardando confirmação' : 'nada pendente'}</span></a>
      <a class="stat" href="#/pedidos">
        <span class="rot">${hojeDom ? 'Hoje' : 'Domingo'} ${esc(domCurto)}</span><span class="val">${pedsDom.length}</span>
        <span class="sub">${pedsDom.length ? `${esc(D.reais(totDom))}${incompleto ? ' + a definir' : ''}` : 'nenhum pedido'}</span></a>
      <a class="stat" href="#/catalogo"${zerados + baixos ? ' data-alerta' : ''}>
        <span class="rot">Estoque baixo</span><span class="val">${zerados + baixos}</span>
        <span class="sub">${zerados + baixos ? [zerados ? `${zerados} zerado${zerados > 1 ? 's' : ''}` : '', baixos ? `${baixos} baixo${baixos > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') : 'tudo em ordem'}</span></a>
      <a class="stat ini-fat" href="#/pedidos">
        <span class="rot">Faturamento de ${esc(nomeMes)}</span><span class="val">${esc(D.reais(fat))}</span>
        <span class="sub">${entreguesMes.length ? plural(entreguesMes.length, 'pedido entregue', 'pedidos entregues') : 'nenhuma entrega ainda'}</span></a>
    </div>`;

  const listaPeds = ultimos.length ? `<div class="lista">${ultimos.map(p => {
    const t = D.totais(p);
    const nItens = p.itens.reduce((s, i) => s + (Number(i.qtd) || 0), 0);
    return `<a class="linha" href="#/pedido/${encodeURIComponent(p.id)}">
      <span class="ini-num num">#${esc(String(p.num))}</span>
      <div class="meio"><b>${esc(p.cliente || 'Sem nome')}</b><span>${esc(D.fmtData(p.domingo))} · ${esc(p.modo || '')} · ${plural(nItens, 'item', 'itens')}</span></div>
      <div class="fim">${UI.pillStatus(p.status)}<span class="ini-tot num">${t.completo ? esc(D.reais(t.total)) : 'a definir'}</span></div>
    </a>`;
  }).join('')}</div>` : `<div class="card ini-prod-vazio">${ICON.pedidos}<div><b>Nenhum pedido ainda</b><span>As encomendas feitas pelo site neste aparelho e as que você lançar aparecem aqui.</span></div></div>`;

  const site = `
    <section class="card ini-site" aria-labelledby="tSite">
      <img src="../img/logo.png" alt="" width="56" height="56" onerror="this.remove()">
      <div class="ini-site-txt"><h3 id="tSite">O site da do'Pira</h3><p>A vitrine onde os clientes fazem as encomendas.</p></div>
      <div class="ini-site-acoes">
        <a class="btn btn-3 btn-sm" href="${esc(UI.URL_SITE)}" target="_blank" rel="noopener">${ICON.site} Abrir o site</a>
        <button type="button" class="btn btn-2 btn-sm" data-copiar-site>${ICON.copiar} Copiar link</button>
        ${navigator.share
          ? `<button type="button" class="btn btn-2 btn-sm" data-compartilhar>${ICON.compartilhar} Compartilhar</button>`
          : `<a class="btn btn-2 btn-sm" href="https://wa.me/?text=${encodeURIComponent('Faça sua encomenda na do\'Pira Defumados: ' + UI.URL_SITE)}" target="_blank" rel="noopener">${ICON.zap} Enviar</a>`}
      </div>
    </section>`;

  return `<div class="ini">
    <header class="cab ini-cab">
      <div><h2>${saudacao()}!</h2><p>${esc(dataExtenso())}${est.exemplo ? ' · <span class="ini-ex">dados de exemplo</span>' : ''}</p></div>
      <a class="btn btn-1 ini-novo" href="#/pedidos">${ICON.pedidos} Ver pedidos</a>
    </header>
    ${passos}
    ${stats}
    <div class="ini-grade">
      <div class="ini-col">
        <section class="secao" aria-labelledby="tProd">
          <h3 id="tProd"><span>Produção · ${hojeDom ? 'hoje' : 'domingo'} ${esc(domCurto)}</span>${ICON.fogo}</h3>
          ${htmlProducao(dom)}
        </section>
        <section class="secao" aria-labelledby="tUlt">
          <h3 id="tUlt"><span>Últimos pedidos</span>${ultimos.length ? '<a class="btn-link ini-ver" href="#/pedidos">Ver todos</a>' : ''}</h3>
          ${listaPeds}
        </section>
      </div>
      <div class="ini-col">
        <section class="secao" aria-label="Previsão do tempo em Pirapozinho">
          <div id="tempo" class="ini-tempo" aria-live="polite">${htmlTempoInicial()}</div>
        </section>
        <div class="secao">${site}</div>
      </div>
    </div>
  </div>`;
}

function montar(el) {
  const raiz = $('.ini', el); if (!raiz) return;
  raiz.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-tempo-atualizar')) atualizarTempo(true);
    else if (b.hasAttribute('data-copiar-site')) UI.copiar(UI.URL_SITE, 'Link do site copiado');
    else if (b.hasAttribute('data-compartilhar')) {
      try { await navigator.share({ title: "do'Pira Defumados", text: 'Faça sua encomenda na do\'Pira Defumados', url: UI.URL_SITE }); }
      catch (err) { if (err && err.name !== 'AbortError') UI.copiar(UI.URL_SITE, 'Link do site copiado'); }
    }
    else if (b.hasAttribute('data-instalar')) {
      if (window.DopiraInstalar) window.DopiraInstalar.pedir(); else UI.ir('#/ajustes');
    }
    else if (b.hasAttribute('data-exemplo')) {
      const ok = await UI.confirmar('Vamos carregar preços, estoque e pedidos FICTÍCIOS para você testar o app. Depois é só apagar em Ajustes e começar de verdade.', { sim: 'Carregar exemplo' });
      if (!ok) return;
      D.carregarExemplo(); App.redesenhar(); UI.toast('Dados de exemplo carregados');
    }
  });
  atualizarTempo(false);
}

TELAS.inicio = { titulo: 'Início', nav: 'inicio', render, montar };

// para testes/depuração
window.Inicio = { condicao, dicas, producao, iconeTempo, TEMPO_CHAVE };
})();
