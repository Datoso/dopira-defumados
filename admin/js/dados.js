/* =====================================================================
   Sistema Dopira · camada de dados (compartilhada por todos os módulos)
   Tudo fica salvo no navegador deste aparelho (localStorage).
   ===================================================================== */
(function () {
'use strict';

const CHAVE = 'dopira-admin-v1';          // estado do app de gestão (o site lê "cupons" daqui)
const CHAVE_SITE = 'dopira-pedidos-site'; // encomendas enviadas pelo site neste aparelho

/* Catálogo inicial: os mesmos produtos do site (img só dos que já têm foto). Preço e estoque começam vazios
   (o dono define); nada de preço inventado. */
const PRODUTOS_INICIAIS = [
  { id:'brisket',    nome:'Brisket',             venda:'kg' },
  { id:'beef-ribs',  nome:'Beef ribs',           venda:'kg' },
  { id:'cupim',      nome:'Cupim',               venda:'kg' },
  { id:'panceta',    nome:'Panceta',             venda:'un', pesoAprox:0.5, img:'../img/panceta.jpg' },
  { id:'costela',    nome:'Costela',             venda:'kg' },
  { id:'linguica',   nome:'Linguiça calabresa',  venda:'kg', img:'../img/linguica.jpg' },
  { id:'costelinha', nome:'Costelinha defumada', venda:'kg' },
  { id:'kit',        nome:'Kit churrasco',       venda:'un', img:'../img/kit.jpg' }
];

function produtoBase(p) {
  return {
    id: p.id, nome: p.nome, venda: p.venda || 'kg',   // 'kg' = vendido por peso · 'un' = por unidade/peça
    preco: p.preco ?? null,                            // R$ por kg ou por unidade (null = ainda não definido)
    desconto: p.desconto ?? 0,                         // % de desconto fixo do produto
    pesoMedio: p.pesoMedio ?? null,                    // kg por peça (só p/ venda kg; usado em estimativas)
    pesoAprox: p.pesoAprox ?? null,                    // venda por unidade: peso aproximado de cada unidade em kg (ex.: 0,5 = unidade de ≈500 g)
    estoque: p.estoque ?? 0,                           // em kg (venda kg) ou unidades (venda un)
    estoqueMin: p.estoqueMin ?? 0,                     // alerta de estoque baixo
    ativo: p.ativo ?? true,                            // disponível para venda
    img: p.img || '', obs: p.obs || ''
  };
}

const CUPOM_DOMINGO = {
  id: 'c-domingo', codigo: 'DOMINGO', tipo: '%', valor: 5, minimo: 0, validade: '', antecedencia: 1,
  primeiraCompra: false, ativo: true, usos: 0, descricao: '5% de desconto para quem pede antes do domingo'
};
const CUPOM_PRIMEIRA = {
  id: 'c-primeira', codigo: 'PRIMEIRACOMPRA', tipo: '%', valor: 20, minimo: 0, validade: '',
  primeiraCompra: true, ativo: true, usos: 0, descricao: '20% de desconto no pedido'
};

function estadoVazio() {
  return {
    versao: 1, seq: 0, exemplo: false,
    produtos: PRODUTOS_INICIAIS.map(produtoBase),
    cupons: [ { ...CUPOM_PRIMEIRA }, { ...CUPOM_DOMINGO } ], migr: 2,
    promocoes: [],   // { id, nome, desconto(%), produtos:['id',...] ou [] = todos, inicio:'YYYY-MM-DD', fim:'YYYY-MM-DD', ativo }
    pedidos: [],     // ver novoPedido()
    movs: [],        // movimentos de estoque { id, t(ISO), prod, delta, motivo, pedido }
    importados: [],  // ids de encomendas do site já importadas
    pix: { chave: '', tipo: 'celular', nome: '', cidade: 'Pirapozinho' }   // recebedor do Pix (Ajustes)
  };
}

/* ---------- carregar / salvar ---------- */
let estado;
const ehObj = o => o && typeof o === 'object' && !Array.isArray(o);
/** Deixa o estado sempre num formato seguro (dados velhos ou editados à mão não derrubam as telas). */
function normalizar(s) {
  const v = estadoVazio();
  const e = { ...v, ...s };
  e.migr = Number(s.migr) || 0;   // dados antigos não têm o marcador de migração
  ['produtos','cupons','promocoes','pedidos','movs','importados'].forEach(k => { if (!Array.isArray(e[k])) e[k] = v[k]; });
  e.produtos = e.produtos.filter(p => ehObj(p) && p.id).map(produtoBase);
  e.cupons = e.cupons.filter(ehObj).map(c => ({ id: c.id || novoId('c'), tipo: c.tipo === 'R$' ? 'R$' : '%', valor: Number(c.valor) || 0, minimo: Number(c.minimo) || 0,
    validade: typeof c.validade === 'string' ? c.validade : '', primeiraCompra: !!c.primeiraCompra, ativo: c.ativo !== false, usos: Number(c.usos) || 0, antecedencia: Number(c.antecedencia) || 0,
    ...c, codigo: String(c.codigo || '').toUpperCase().replace(/\s+/g, ''), descricao: String(c.descricao || '') })).filter(c => c.codigo);
  e.promocoes = e.promocoes.filter(ehObj).map(p => ({ ...p, nome: String(p.nome || 'Promoção'), desconto: Number(p.desconto) || 0,
    produtos: Array.isArray(p.produtos) ? p.produtos.filter(x => typeof x === 'string') : [], inicio: typeof p.inicio === 'string' ? p.inicio : '', fim: typeof p.fim === 'string' ? p.fim : '' }));
  e.pedidos = e.pedidos.filter(ehObj).map(p => ({ ...p, id: p.id || novoId('p'), criado: typeof p.criado === 'string' ? p.criado : new Date().toISOString(),
    itens: Array.isArray(p.itens) ? p.itens.filter(ehObj) : [], status: STATUS_IDS.includes(p.status) ? p.status : 'novo',
    cliente: String(p.cliente || ''), telefone: String(p.telefone || ''), cupom: String(p.cupom || '') }));
  e.movs = e.movs.filter(ehObj);
  e.pix = ehObj(s.pix) ? { ...v.pix, ...s.pix } : v.pix;
  e.pedidos.forEach(p => { if (!PAGAMENTOS.includes(p.pagamento)) p.pagamento = ''; });
  e.importados = e.importados.filter(x => typeof x === 'string');
  // migração: cupom DOMINGO (5% para quem pede antes do domingo) e panceta vendida em unidade de ≈500 g
  if ((Number(e.migr) || 0) < 2) {
    if (!e.cupons.some(c => c.codigo === 'DOMINGO')) e.cupons.push({ ...CUPOM_DOMINGO });
    const pa = e.produtos.find(p => p.id === 'panceta');
    if (pa && pa.venda === 'kg' && pa.preco === null && !(pa.estoque > 0)) { pa.venda = 'un'; pa.pesoAprox = 0.5; pa.pesoMedio = null; }
    e.migr = 2;
  }
  e.seq = Math.max(Number(e.seq) || 0, ...e.pedidos.map(p => Number(p.num) || 0));
  return e;
}
let avisoCarga = '';
function carregar() {
  const bruto = (() => { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } })();
  if (bruto) {
    try {
      const s = JSON.parse(bruto);
      if (ehObj(s) && Array.isArray(s.produtos)) { estado = normalizar(s); return; }
    } catch (e) {}
    // dados ilegíveis: guarda uma cópia antes de começar do zero
    try { localStorage.setItem(CHAVE + '-corrompido', bruto); } catch (e) {}
    avisoCarga = 'Os dados salvos estavam danificados. Uma cópia foi guardada e o app começou do zero. Restaure um backup em Ajustes.';
  }
  estado = estadoVazio();
}
const ouvintes = [];
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) {}
  ouvintes.forEach(f => { try { f(); } catch (e) {} });
}
function aoMudar(f) { ouvintes.push(f); }

/* ---------- utilidades ---------- */
const novoId = (pre = '') => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const arred = (n, c = 2) => Math.round(n * 10 ** c) / 10 ** c;

/** Converte texto do usuário ("12,5", "R$ 1.200,50") em número. Vazio/ inválido → null. */
function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (!s || !/^-?[\d.,]+$/.test(s)) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   // "1.234" = mil duzentos e trinta e quatro
  const n = Number(s);
  return isFinite(n) ? n : null;
}
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const reais = n => (n === null || n === undefined || !isFinite(n)) ? '—' : BRL.format(n);
const fmtNum = (n, c = 3) => (n === null || n === undefined || !isFinite(n)) ? '—'
  : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: c }).format(n);
/** "12,5 kg" ou "3 un" */
const qtd = (n, venda) => venda === 'un' ? `${fmtNum(n, 0)} un` : `${fmtNum(n, 3)} kg`;
/** Número para preencher um <input> (com vírgula). */
const paraInput = (n, c = 3) => (n === null || n === undefined || !isFinite(n)) ? ''
  : String(arred(n, c)).replace('.', ',');

/* ---------- datas ---------- */
const hojeISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
function isoDe(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function dataDeISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); }
/** Próximo domingo (hoje, se hoje for domingo). */
function proximoDomingo() { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return isoDe(d); }
const DIAS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
/** "dom, 01/11" */
function fmtData(iso, longo = false) {
  if (!iso) return '—';
  const d = dataDeISO(iso.slice(0, 10));
  const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0');
  return longo ? `${DIAS[d.getDay()]}, ${dd}/${mm}` : `${DIAS[d.getDay()].slice(0, 3)}, ${dd}/${mm}`;
}
function fmtDataHora(isoT) {
  if (!isoT) return '—';
  const d = new Date(isoT);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ---------- produtos e preços ---------- */
const produto = id => estado.produtos.find(p => p.id === id) || null;

/** Promoções ativas hoje que valem para o produto. */
function promocoesDo(prod, dia = hojeISO()) {
  return estado.promocoes.filter(pr => pr.ativo
    && (!pr.inicio || pr.inicio <= dia) && (!pr.fim || pr.fim >= dia)
    && (!pr.produtos || !pr.produtos.length || pr.produtos.includes(prod.id)));
}
/** Maior desconto % que vale para o produto (o do produto ou de uma promoção ativa). Não somam. */
function descontoDo(prod, dia) {
  const promos = promocoesDo(prod, dia);
  let melhor = { pct: Number(prod.desconto) || 0, origem: (Number(prod.desconto) || 0) > 0 ? 'produto' : null, promo: null };
  promos.forEach(pr => { if ((Number(pr.desconto) || 0) > melhor.pct) melhor = { pct: Number(pr.desconto), origem: 'promocao', promo: pr }; });
  return melhor;
}
/** Preço com desconto (por kg ou por un). null se o preço ainda não foi definido. */
function precoEfetivo(prod, dia) {
  if (!prod || prod.preco === null || prod.preco === undefined) return null;
  return arred(prod.preco * (1 - descontoDo(prod, dia).pct / 100));
}
/** "500 g" ou "1,2 kg" */
const fmtPeso = kg => (kg === null || kg === undefined || !isFinite(kg)) ? '—' : kg < 1 ? `${fmtNum(kg * 1000, 0)} g` : `${fmtNum(kg, 3)} kg`;
/** Texto da forma de venda: "/kg", "/un" ou "/un (≈500 g)" */
const rotuloVenda = prod => !prod ? '' : prod.venda === 'un' ? (prod.pesoAprox > 0 ? `/un (≈${fmtPeso(prod.pesoAprox)})` : '/un') : '/kg';
/** Nome curto da forma de venda: "Por kg", "Unidade", "Unidade de ≈500 g" */
const nomeVenda = prod => !prod ? '' : prod.venda === 'un' ? (prod.pesoAprox > 0 ? `Unidade de ≈${fmtPeso(prod.pesoAprox)}` : 'Unidade') : 'Por kg';
/** Situação do estoque: 'zerado' | 'baixo' | 'ok' */
function situacaoEstoque(prod) {
  if ((prod.estoque || 0) <= 0) return 'zerado';
  if (prod.estoqueMin > 0 && prod.estoque <= prod.estoqueMin) return 'baixo';
  return 'ok';
}
/** Para venda por kg: quantas peças o estoque dá (usa peso médio). */
function pecasEstimadas(prod) {
  return prod.venda === 'kg' && prod.pesoMedio > 0 ? Math.floor((prod.estoque || 0) / prod.pesoMedio) : null;
}

/* ---------- estoque ---------- */
/** Soma (ou subtrai) do estoque e registra o movimento. */
function ajustarEstoque(prodId, delta, motivo = 'Ajuste', pedidoId = null) {
  const p = produto(prodId); if (!p || !delta) return;
  p.estoque = arred((p.estoque || 0) + delta, 3);
  estado.movs.unshift({ id: novoId('m'), t: new Date().toISOString(), prod: prodId, delta: arred(delta, 3), motivo, pedido: pedidoId });
  estado.movs = estado.movs.slice(0, 400);
}

/* ---------- pedidos ---------- */
/*  pedido = {
      id, num, criado(ISO), origem:'site'|'manual'|'exemplo',
      cliente, telefone, domingo:'YYYY-MM-DD', modo:'Entrega'|'Retirada', endereco, referencia, obs,
      itens: [ { prod, qtd (peças ou un), peso (kg real, opcional, só p/ venda kg), preco (R$ unit. congelado, opcional) } ],
      cupom:'CODIGO', taxa: R$ entrega, status, baixado: bool (estoque já descontado), pago: bool
    } */
/** Formas de pagamento aceitas ('' = ainda não definido). trocoPara: R$ (só dinheiro). */
const PAGAMENTOS = ['', 'Pix', 'Dinheiro', 'Cartão'];
const STATUS_IDS = ['novo','confirmado','pronto','entregue','cancelado'];
const STATUS = [
  { id: 'novo',       nome: 'Novo' },
  { id: 'confirmado', nome: 'Confirmado' },
  { id: 'pronto',     nome: 'Pronto' },
  { id: 'entregue',   nome: 'Entregue' },
  { id: 'cancelado',  nome: 'Cancelado' }
];
carregar();
const nomeStatus = id => (STATUS.find(s => s.id === id) || { nome: id }).nome;

function novoPedido(dados = {}) {
  estado.seq = (estado.seq || 0) + 1;
  const p = {
    id: novoId('p'), num: estado.seq, criado: new Date().toISOString(), origem: 'manual',
    cliente: '', telefone: '', domingo: proximoDomingo(), modo: 'Entrega', endereco: '', referencia: '', obs: '',
    itens: [], cupom: '', taxa: 0, status: 'novo', baixado: false, pago: false, pagamento: '', trocoPara: null,
    ...dados
  };
  estado.pedidos.unshift(p);
  return p;
}
const pedido = id => estado.pedidos.find(p => p.id === id) || null;
/** Data LOCAL (Brasília) em que o pedido foi feito, 'YYYY-MM-DD'. */
const diaDoPedido = ped => { const d = new Date(ped && ped.criado || Date.now()); return isNaN(d) ? hojeISO() : isoDe(d); };
/** Preço efetivo do produto na data do pedido. */
const precoNoPedido = (prod, ped) => precoEfetivo(prod, diaDoPedido(ped));

/** Quantidade que sai do estoque para um item (kg ou un). null = não dá pra saber (falta peso). */
function quantidadeEstoque(item) {
  const prod = produto(item.prod); if (!prod) return null;
  if (prod.venda === 'un') return Number(item.qtd) || 0;
  if (item.peso > 0) return item.peso;
  if (prod.pesoMedio > 0) return arred((Number(item.qtd) || 0) * prod.pesoMedio, 3);
  return null;
}

const soDigitos = s => String(s || '').replace(/\D/g, '');
/** Telefone normalizado com DDD (sem 55); número sem DDD assume 18 (região de Pirapozinho). */
const telNorm = t => { let d = soDigitos(t); if (d.startsWith('55') && d.length >= 12) d = d.slice(2); if (d.startsWith('0')) d = d.slice(1); if (d.length <= 9 && d.length >= 8) d = '18' + d; return d; };
const mesmoCliente = (a, b) => {
  const ta = telNorm(a.telefone), tb = telNorm(b.telefone);
  if (ta && tb) return ta === tb;
  return !!a.cliente && a.cliente.trim().toLowerCase() === (b.cliente || '').trim().toLowerCase();
};

/** Valida o cupom do pedido. Retorna { cupom, ok, motivo } (cupom null se não tem código). */
function validarCupom(ped, subtotal, parcial) {
  const cod = String(ped.cupom || '').toUpperCase().replace(/\s+/g, '');
  if (!cod) return { cupom: null, ok: false, motivo: '' };
  // depois de confirmado, vale o cupom como estava na confirmação (editar/excluir o cupom não muda pedidos antigos)
  if (ped.baixado && ped.cupomAplicado !== undefined) {
    const ca = ped.cupomAplicado;
    if (ca && ca.codigo === cod) return { cupom: ca, ok: true, motivo: '', congelado: true };
    if (ca === null && ped.cupomCodigoNaConfirmacao === cod) return { cupom: null, ok: false, motivo: 'Cupom não valia na confirmação' };
  }
  const c = estado.cupons.find(x => x.codigo.toUpperCase() === cod);
  if (!c) return { cupom: null, ok: false, motivo: 'Cupom não existe' };
  if (!c.ativo) return { cupom: c, ok: false, motivo: 'Cupom desativado' };
  const dia = diaDoPedido(ped);
  if (c.validade && c.validade < dia) return { cupom: c, ok: false, motivo: 'Cupom vencido' };
  if (c.minimo > 0 && subtotal !== null && subtotal < c.minimo)
    return { cupom: c, ok: false, motivo: parcial ? `Pedido mínimo de ${reais(c.minimo)} (faltam preços/pesos para conferir)` : `Pedido mínimo de ${reais(c.minimo)}` };
  if (c.antecedencia > 0 && ped.domingo) {
    const dias = Math.round((dataDeISO(ped.domingo) - dataDeISO(dia)) / 86400000);
    if (dias < c.antecedencia) return { cupom: c, ok: false, motivo: c.antecedencia === 1 ? 'Só vale para pedidos feitos antes do domingo' : `Só vale para pedidos feitos com ${c.antecedencia} dias de antecedência` };
  }
  if (c.primeiraCompra) {
    const antes = estado.pedidos.some(o => o.id !== ped.id && o.status !== 'cancelado'
      && o.criado < ped.criado && mesmoCliente(o, ped));
    if (antes) return { cupom: c, ok: false, motivo: 'Cliente já comprou antes (só vale na primeira compra)' };
  }
  return { cupom: c, ok: true, motivo: '' };
}

/** Calcula valores do pedido.
    Retorna { linhas:[{item, prod, preco, base(kg ou un), valor, estimado, semPreco}], subtotal, desconto, cupom:{...}, taxa, total, completo } */
function totais(ped) {
  let subtotal = 0, completo = true;
  const linhas = ped.itens.map(item => {
    const prod = produto(item.prod);
    const preco = item.preco ?? (prod ? precoNoPedido(prod, ped) : null);
    let base = null, estimado = false;
    if (prod && prod.venda === 'un') base = Number(item.qtd) || 0;
    else if (item.peso > 0) base = item.peso;
    else if (prod && prod.pesoMedio > 0) { base = arred((Number(item.qtd) || 0) * prod.pesoMedio, 3); estimado = true; }
    const valor = (preco !== null && base !== null) ? arred(preco * base) : null;
    if (valor === null) completo = false; else subtotal += valor;
    return { item, prod, preco, base, valor, estimado, semPreco: preco === null, semPeso: base === null };
  });
  subtotal = arred(subtotal);
  const cup = validarCupom(ped, subtotal, !completo);
  let desconto = 0;
  if (cup.ok) desconto = cup.cupom.tipo === '%' ? arred(subtotal * cup.cupom.valor / 100) : Math.min(subtotal, Number(cup.cupom.valor) || 0);
  const taxa = ped.modo === 'Retirada' ? 0 : Math.max(0, Number(ped.taxa) || 0);
  return { linhas, subtotal, desconto, cupom: cup, taxa, total: arred(Math.max(0, subtotal - desconto) + taxa), completo };
}

/** Muda o status e cuida do estoque:
    - ao sair de "novo" para confirmado/pronto/entregue pela 1ª vez: dá baixa no estoque
    - ao cancelar (ou voltar para "novo") um pedido que já deu baixa: devolve ao estoque
    Retorna lista de avisos (ex.: itens sem peso que não deram baixa). */
function mudarStatus(ped, novo) {
  const avisos = [];
  const baixa = ['confirmado', 'pronto', 'entregue'].includes(novo);
  if (baixa && !ped.baixado) {
    ped.itens.forEach(it => {
      const q = quantidadeEstoque(it), prod = produto(it.prod);
      if (q === null) { avisos.push(`${prod ? prod.nome : it.prod}: informe o peso para dar baixa no estoque`); it.semBaixa = true; return; }
      ajustarEstoque(it.prod, -q, `Pedido #${ped.num}`, ped.id); it.baixa = q; it.semBaixa = false;
    });
    // congela o preço do momento da confirmação
    ped.itens.forEach(it => { if (it.preco === undefined || it.preco === null) { const pr = produto(it.prod); const v = pr ? precoNoPedido(pr, ped) : null; if (v !== null) { it.preco = v; it.precoAuto = true; } } });
    const cup = totais(ped).cupom;
    if (cup.ok && cup.cupom) {
      const orig = estado.cupons.find(x => x.codigo === cup.cupom.codigo);
      if (orig) orig.usos = (orig.usos || 0) + 1;
      ped.cupomAplicado = { codigo: cup.cupom.codigo, tipo: cup.cupom.tipo, valor: Number(cup.cupom.valor) || 0, descricao: cup.cupom.descricao || '' };
      ped.cupomContado = !!orig;
    } else { ped.cupomAplicado = null; ped.cupomCodigoNaConfirmacao = String(ped.cupom || '').toUpperCase().replace(/\s+/g, ''); }
    ped.baixado = true;
  }
  if (!baixa && ped.baixado) {
    ped.itens.forEach(it => { if (it.baixa > 0) ajustarEstoque(it.prod, it.baixa, `Pedido #${ped.num} ${novo === 'cancelado' ? 'cancelado' : 'reaberto'}`, ped.id); it.baixa = 0; });
    ped.baixado = false;
    if (ped.cupomContado && ped.cupomAplicado) { const c = estado.cupons.find(x => x.codigo === ped.cupomAplicado.codigo); if (c && c.usos > 0) c.usos--; }
    ped.cupomContado = false; delete ped.cupomAplicado; delete ped.cupomCodigoNaConfirmacao;
    ped.itens.forEach(it => { if (it.precoAuto) { delete it.preco; delete it.precoAuto; } });
  }
  ped.status = novo;
  return avisos;
}

/** Traz as encomendas enviadas pelo site neste aparelho. Retorna quantas entraram. */
function importarDoSite() {
  let lista = [];
  try { lista = JSON.parse(localStorage.getItem(CHAVE_SITE) || '[]'); } catch (e) {}
  if (!Array.isArray(lista)) return 0;
  let n = 0;
  lista.forEach(s => {
    if (!s || !s.id || estado.importados.includes(s.id)) return;
    const ent = Object.entries(ehObj(s.itens) ? s.itens : {}).filter(([, q]) => Number(q) > 0);
    const itens = ent.filter(([id]) => produto(id)).map(([id, q]) => ({ prod: id, qtd: Number(q) }));
    const faltam = ent.filter(([id]) => !produto(id)).map(([id, q]) => `${q}x ${id}`);
    if (faltam.length) s.obs = `${s.obs ? s.obs + ' · ' : ''}Itens fora do catálogo: ${faltam.join(', ')}`;
    novoPedido({
      origem: 'site', criado: s.criado || new Date().toISOString(), cliente: s.nome || '', telefone: s.telefone || '',
      domingo: s.domingo || proximoDomingo(), modo: s.modo || 'Entrega', endereco: s.endereco || '', referencia: s.referencia || '',
      obs: s.obs || '', cupom: s.cupom || '', pagamento: PAGAMENTOS.includes(s.pagamento) ? s.pagamento : '', trocoPara: num(s.troco), itens
    });
    estado.importados.push(s.id); n++;
  });
  if (n) salvar();
  return n;
}

/* ---------- dados de exemplo (fictícios, só para testar o app) ---------- */
function carregarExemplo() {
  const e = estadoVazio();
  e.exemplo = true;
  const ex = { // valores FICTÍCIOS só para demonstrar
    'brisket':    { preco: 120, pesoMedio: 3.5, estoque: 10.5, estoqueMin: 4 },
    'beef-ribs':  { preco: 110, pesoMedio: 2,   estoque: 6,    estoqueMin: 4 },
    'cupim':      { preco: 90,  pesoMedio: 1.5, estoque: 3,    estoqueMin: 3 },
    'panceta':    { preco: 40,  estoque: 8,    estoqueMin: 3, desconto: 10 },
    'costela':    { preco: 80,  pesoMedio: 2.5, estoque: 0,    estoqueMin: 2 },
    'linguica':   { preco: 55,  pesoMedio: 0.5, estoque: 12,   estoqueMin: 3 },
    'costelinha': { preco: 65,  pesoMedio: 1.2, estoque: 7.2,  estoqueMin: 2 },
    'kit':        { preco: 180, estoque: 5, estoqueMin: 2 }
  };
  e.produtos = e.produtos.map(p => produtoBase({ ...p, ...ex[p.id] }));
  e.importados = jaVistas();
  const hoje = hojeISO(), dom = proximoDomingo();
  const somaDias = (iso, n) => { const d = dataDeISO(iso); d.setDate(d.getDate() + n); return isoDe(d); };
  e.promocoes = [{ id: novoId('pr'), nome: 'Semana da linguiça (exemplo)', desconto: 15, produtos: ['linguica'], inicio: hoje, fim: somaDias(hoje, 6), ativo: true }];
  const antes = estado; estado = e;
  const t0 = Date.now();
  const mk = (min, d) => novoPedido({ origem: 'exemplo', criado: new Date(t0 - min * 60000).toISOString(), ...d });
  mk(60 * 30, { cliente: 'Cliente Exemplo 1', telefone: '(18) 90000-0001', domingo: somaDias(dom, -7), modo: 'Retirada', itens: [{ prod: 'brisket', qtd: 1, peso: 3.6, preco: 120 }], status: 'entregue', baixado: true, pago: true });
  mk(300, { cliente: 'Cliente Exemplo 2', telefone: '(18) 90000-0002', domingo: dom, endereco: 'Rua Exemplo, 100', itens: [{ prod: 'beef-ribs', qtd: 1 }, { prod: 'linguica', qtd: 2 }], cupom: 'PRIMEIRACOMPRA' });
  mk(120, { cliente: 'Cliente Exemplo 3', telefone: '(18) 90000-0003', domingo: dom, modo: 'Retirada', itens: [{ prod: 'kit', qtd: 1 }, { prod: 'panceta', qtd: 1 }] });
  mk(30, { cliente: 'Cliente Exemplo 1', telefone: '(18) 90000-0001', domingo: dom, endereco: 'Rua Exemplo, 200', itens: [{ prod: 'costelinha', qtd: 2 }], cupom: 'PRIMEIRACOMPRA', obs: 'Cupom não deve valer: já comprou antes' });
  const conf = e.pedidos.find(p => p.cliente === 'Cliente Exemplo 3'); mudarStatus(conf, 'confirmado');
  e.movs.push({ id: novoId('m'), t: new Date(t0 - 3 * 86400000).toISOString(), prod: 'brisket', delta: 14.1, motivo: 'Entrada: fornada (exemplo)', pedido: null });
  void antes;
  salvar();
}
/** Ids das encomendas do site que já passaram por aqui (para não voltarem depois de apagar/restaurar). */
function jaVistas() {
  const ids = new Set(estado ? estado.importados : []);
  try { (JSON.parse(localStorage.getItem(CHAVE_SITE) || '[]') || []).forEach(s => { if (s && s.id) ids.add(s.id); }); } catch (e) {}
  return [...ids];
}
/** O que o site pode mostrar ao público: preços, descontos, promoções, cupons ativos e a chave Pix.
    (Nada de estoque, pedidos ou clientes.) Vira o arquivo precos.json publicado junto do site. */
function dadosPublicos() {
  const hoje = hojeISO();
  return {
    gerado: new Date().toISOString(),
    produtos: estado.produtos.map(p => ({ id: p.id, nome: p.nome, venda: p.venda, preco: p.preco, desconto: Number(p.desconto) || 0,
      pesoMedio: p.pesoMedio, pesoAprox: p.pesoAprox, ativo: p.ativo })),
    promocoes: estado.promocoes.filter(p => p.ativo && (!p.fim || p.fim >= hoje)).map(p => ({ nome: p.nome, desconto: p.desconto, produtos: p.produtos, inicio: p.inicio, fim: p.fim, ativo: true })),
    cupons: estado.cupons.filter(c => c.ativo).map(c => ({ codigo: c.codigo, tipo: c.tipo, valor: c.valor, minimo: c.minimo, validade: c.validade,
      primeiraCompra: c.primeiraCompra, antecedencia: c.antecedencia || 0, ativo: true, descricao: c.descricao })),
    pix: estado.pix && estado.pix.chave ? { chave: estado.pix.chave, nome: estado.pix.nome, cidade: estado.pix.cidade } : null
  };
}
function apagarTudo() { const v = jaVistas(); estado = estadoVazio(); estado.importados = v; salvar(); }
function substituirEstado(novo) {
  if (!ehObj(novo) || !Array.isArray(novo.produtos) || !novo.produtos.some(p => ehObj(p) && p.id)) throw new Error('Arquivo de backup inválido');
  const n = normalizar(novo);
  n.importados = [...new Set([...n.importados, ...jaVistas()])];
  estado = n; salvar();
}

/* ---------- exporta ---------- */
window.D = {
  get estado() { return estado; },
  CHAVE, CHAVE_SITE, STATUS, nomeStatus, PAGAMENTOS,
  salvar, carregar, aoMudar, novoId, arred, num, reais, fmtNum, qtd, paraInput,
  hojeISO, isoDe, dataDeISO, proximoDomingo, fmtData, fmtDataHora, DIAS, MESES,
  produto, produtoBase, fmtPeso, rotuloVenda, nomeVenda, promocoesDo, descontoDo, precoEfetivo, situacaoEstoque, pecasEstimadas,
  ajustarEstoque, novoPedido, pedido, diaDoPedido, precoNoPedido, get avisoCarga() { return avisoCarga; }, normalizar, quantidadeEstoque, validarCupom, totais, mudarStatus, soDigitos,
  importarDoSite, dadosPublicos, carregarExemplo, apagarTudo, substituirEstado
};
})();
