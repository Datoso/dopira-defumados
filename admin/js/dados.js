/* =====================================================================
   Dopira Gestão · camada de dados (compartilhada por todos os módulos)
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
  { id:'panceta',    nome:'Panceta',             venda:'kg', img:'../img/panceta.jpg' },
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
    estoque: p.estoque ?? 0,                           // em kg (venda kg) ou unidades (venda un)
    estoqueMin: p.estoqueMin ?? 0,                     // alerta de estoque baixo
    ativo: p.ativo ?? true,                            // disponível para venda
    img: p.img || '', obs: p.obs || ''
  };
}

const CUPOM_PRIMEIRA = {
  id: 'c-primeira', codigo: 'PRIMEIRACOMPRA', tipo: '%', valor: 20, minimo: 0, validade: '',
  primeiraCompra: true, ativo: true, usos: 0, descricao: '20% de desconto no pedido'
};

function estadoVazio() {
  return {
    versao: 1, seq: 0, exemplo: false,
    produtos: PRODUTOS_INICIAIS.map(produtoBase),
    cupons: [ { ...CUPOM_PRIMEIRA } ],
    promocoes: [],   // { id, nome, desconto(%), produtos:['id',...] ou [] = todos, inicio:'YYYY-MM-DD', fim:'YYYY-MM-DD', ativo }
    pedidos: [],     // ver novoPedido()
    movs: [],        // movimentos de estoque { id, t(ISO), prod, delta, motivo, pedido }
    importados: []   // ids de encomendas do site já importadas
  };
}

/* ---------- carregar / salvar ---------- */
let estado;
function carregar() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (s && typeof s === 'object' && Array.isArray(s.produtos)) {
      const v = estadoVazio();
      estado = { ...v, ...s };
      ['produtos','cupons','promocoes','pedidos','movs','importados'].forEach(k => { if (!Array.isArray(estado[k])) estado[k] = v[k]; });
      estado.produtos = estado.produtos.map(produtoBase);
      return;
    }
  } catch (e) {}
  estado = estadoVazio();
}
const ouvintes = [];
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) {}
  ouvintes.forEach(f => { try { f(); } catch (e) {} });
}
function aoMudar(f) { ouvintes.push(f); }
carregar();

/* ---------- utilidades ---------- */
const novoId = (pre = '') => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const arred = (n, c = 2) => Math.round(n * 10 ** c) / 10 ** c;

/** Converte texto do usuário ("12,5", "R$ 1.200,50") em número. Vazio/ inválido → null. */
function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
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
const STATUS = [
  { id: 'novo',       nome: 'Novo' },
  { id: 'confirmado', nome: 'Confirmado' },
  { id: 'pronto',     nome: 'Pronto' },
  { id: 'entregue',   nome: 'Entregue' },
  { id: 'cancelado',  nome: 'Cancelado' }
];
const nomeStatus = id => (STATUS.find(s => s.id === id) || { nome: id }).nome;

function novoPedido(dados = {}) {
  estado.seq = (estado.seq || 0) + 1;
  const p = {
    id: novoId('p'), num: estado.seq, criado: new Date().toISOString(), origem: 'manual',
    cliente: '', telefone: '', domingo: proximoDomingo(), modo: 'Entrega', endereco: '', referencia: '', obs: '',
    itens: [], cupom: '', taxa: 0, status: 'novo', baixado: false, pago: false,
    ...dados
  };
  estado.pedidos.unshift(p);
  return p;
}
const pedido = id => estado.pedidos.find(p => p.id === id) || null;

/** Quantidade que sai do estoque para um item (kg ou un). null = não dá pra saber (falta peso). */
function quantidadeEstoque(item) {
  const prod = produto(item.prod); if (!prod) return null;
  if (prod.venda === 'un') return Number(item.qtd) || 0;
  if (item.peso > 0) return item.peso;
  if (prod.pesoMedio > 0) return arred((Number(item.qtd) || 0) * prod.pesoMedio, 3);
  return null;
}

const soDigitos = s => String(s || '').replace(/\D/g, '');
const mesmoCliente = (a, b) => {
  const ta = soDigitos(a.telefone).slice(-8), tb = soDigitos(b.telefone).slice(-8);
  if (ta && tb) return ta === tb;
  return !!a.cliente && a.cliente.trim().toLowerCase() === (b.cliente || '').trim().toLowerCase();
};

/** Valida o cupom do pedido. Retorna { cupom, ok, motivo } (cupom null se não tem código). */
function validarCupom(ped, subtotal) {
  const cod = String(ped.cupom || '').toUpperCase().replace(/\s+/g, '');
  if (!cod) return { cupom: null, ok: false, motivo: '' };
  const c = estado.cupons.find(x => x.codigo.toUpperCase() === cod);
  if (!c) return { cupom: null, ok: false, motivo: 'Cupom não existe' };
  if (!c.ativo) return { cupom: c, ok: false, motivo: 'Cupom desativado' };
  const dia = (ped.criado || new Date().toISOString()).slice(0, 10);
  if (c.validade && c.validade < dia) return { cupom: c, ok: false, motivo: 'Cupom vencido' };
  if (c.minimo > 0 && subtotal !== null && subtotal < c.minimo) return { cupom: c, ok: false, motivo: `Pedido mínimo de ${reais(c.minimo)}` };
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
    const preco = item.preco ?? (prod ? precoEfetivo(prod, (ped.criado || '').slice(0, 10) || undefined) : null);
    let base = null, estimado = false;
    if (prod && prod.venda === 'un') base = Number(item.qtd) || 0;
    else if (item.peso > 0) base = item.peso;
    else if (prod && prod.pesoMedio > 0) { base = arred((Number(item.qtd) || 0) * prod.pesoMedio, 3); estimado = true; }
    const valor = (preco !== null && base !== null) ? arred(preco * base) : null;
    if (valor === null) completo = false; else subtotal += valor;
    return { item, prod, preco, base, valor, estimado, semPreco: preco === null, semPeso: base === null };
  });
  subtotal = arred(subtotal);
  const cup = validarCupom(ped, completo ? subtotal : null);
  let desconto = 0;
  if (cup.ok) desconto = cup.cupom.tipo === '%' ? arred(subtotal * cup.cupom.valor / 100) : Math.min(subtotal, Number(cup.cupom.valor) || 0);
  const taxa = Number(ped.taxa) || 0;
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
    ped.itens.forEach(it => { if (it.preco === undefined || it.preco === null) { const pr = produto(it.prod); const v = pr ? precoEfetivo(pr) : null; if (v !== null) it.preco = v; } });
    ped.baixado = true;
    const cup = validarCupom(ped, null); if (cup.ok) { cup.cupom.usos = (cup.cupom.usos || 0) + 1; ped.cupomContado = true; }
  }
  if (!baixa && ped.baixado) {
    ped.itens.forEach(it => { if (it.baixa > 0) ajustarEstoque(it.prod, it.baixa, `Pedido #${ped.num} ${novo === 'cancelado' ? 'cancelado' : 'reaberto'}`, ped.id); it.baixa = 0; });
    ped.baixado = false;
    if (ped.cupomContado) { const c = estado.cupons.find(x => x.codigo.toUpperCase() === String(ped.cupom).toUpperCase()); if (c && c.usos > 0) c.usos--; ped.cupomContado = false; }
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
    const itens = Object.entries(s.itens || {}).filter(([id, q]) => produto(id) && q > 0).map(([id, q]) => ({ prod: id, qtd: q }));
    novoPedido({
      origem: 'site', criado: s.criado || new Date().toISOString(), cliente: s.nome || '', telefone: s.telefone || '',
      domingo: s.domingo || proximoDomingo(), modo: s.modo || 'Entrega', endereco: s.endereco || '', referencia: s.referencia || '',
      obs: s.obs || '', cupom: s.cupom || '', itens
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
    'panceta':    { preco: 75,  pesoMedio: 1,   estoque: 8,    estoqueMin: 2, desconto: 10 },
    'costela':    { preco: 80,  pesoMedio: 2.5, estoque: 0,    estoqueMin: 2 },
    'linguica':   { preco: 55,  pesoMedio: 0.5, estoque: 12,   estoqueMin: 3 },
    'costelinha': { preco: 65,  pesoMedio: 1.2, estoque: 7.2,  estoqueMin: 2 },
    'kit':        { preco: 180, estoque: 5, estoqueMin: 2 }
  };
  e.produtos = e.produtos.map(p => produtoBase({ ...p, ...ex[p.id] }));
  const hoje = hojeISO(), dom = proximoDomingo();
  const somaDias = (iso, n) => { const d = dataDeISO(iso); d.setDate(d.getDate() + n); return isoDe(d); };
  e.promocoes = [{ id: novoId('pr'), nome: 'Semana da linguiça (exemplo)', desconto: 15, produtos: ['linguica'], inicio: hoje, fim: somaDias(hoje, 6), ativo: true }];
  e.cupons.push({ id: novoId('c'), codigo: 'DOMINGO10', tipo: 'R$', valor: 10, minimo: 100, validade: somaDias(hoje, 30), primeiraCompra: false, ativo: true, usos: 0, descricao: 'R$ 10 off acima de R$ 100 (exemplo)' });
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
function apagarTudo() { estado = estadoVazio(); salvar(); }
function substituirEstado(novo) {
  if (!novo || typeof novo !== 'object' || !Array.isArray(novo.produtos)) throw new Error('Arquivo de backup inválido');
  try { localStorage.setItem(CHAVE, JSON.stringify(novo)); } catch (e) {}
  carregar(); salvar();
}

/* ---------- exporta ---------- */
window.D = {
  get estado() { return estado; },
  CHAVE, CHAVE_SITE, STATUS, nomeStatus,
  salvar, carregar, aoMudar, novoId, arred, num, reais, fmtNum, qtd, paraInput,
  hojeISO, isoDe, dataDeISO, proximoDomingo, fmtData, fmtDataHora, DIAS, MESES,
  produto, produtoBase, promocoesDo, descontoDo, precoEfetivo, situacaoEstoque, pecasEstimadas,
  ajustarEstoque, novoPedido, pedido, quantidadeEstoque, validarCupom, totais, mudarStatus, soDigitos,
  importarDoSite, carregarExemplo, apagarTudo, substituirEstado
};
})();
