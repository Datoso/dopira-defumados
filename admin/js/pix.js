/* =====================================================================
   Dopira Gestão · Pix "copia e cola" (BR Code estático, padrão do Banco Central)
   Gera o código com o valor e o número do pedido. Não precisa de banco nem
   de internet: o cliente cola o código (ou lê o QR) no app do banco dele.
   Uso:
     Pix.config()                       → { chave, tipo, nome, cidade } salvos em D.estado.pix
     Pix.pronto()                       → true se a chave e o nome estão cadastrados
     Pix.doPedido(ped)                  → { codigo, valor, txid } ou null (sem config / total 0)
     Pix.codigo({ chave, nome, cidade, valor, txid, mensagem })
     Pix.qrSVG(texto, tamanhoPx)        → string <svg> do QR Code
     Pix.normalizarChave(texto, tipo)   → { chave, tipo, erro }
   ===================================================================== */
(function () {
'use strict';

const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const limpo = (s, max) => semAcento(s).replace(/[^A-Za-z0-9 .,\-\/@+]/g, '').trim().slice(0, max);
const campo = (id, valor) => id + String(valor.length).padStart(2, '0') + valor;

/** CRC16-CCITT-FALSE (polinômio 0x1021, início 0xFFFF), como pede o BR Code. */
function crc16(txt) {
  let crc = 0xFFFF;
  for (let i = 0; i < txt.length; i++) {
    crc ^= txt.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const TIPOS = [
  { id: 'celular',   nome: 'Celular' },
  { id: 'cpf',       nome: 'CPF' },
  { id: 'cnpj',      nome: 'CNPJ' },
  { id: 'email',     nome: 'E-mail' },
  { id: 'aleatoria', nome: 'Chave aleatória' }
];

/** Arruma a chave no formato que o Pix exige. */
function normalizarChave(texto, tipo) {
  const t = String(texto || '').trim();
  const dig = t.replace(/\D/g, '');
  if (!t) return { chave: '', tipo, erro: 'Informe a chave Pix' };
  if (tipo === 'celular') {
    let d = dig; if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
    if (d.length !== 10 && d.length !== 11) return { chave: t, tipo, erro: 'Celular com DDD, ex.: (18) 99649-1204' };
    return { chave: '+55' + d, tipo };
  }
  if (tipo === 'cpf') return dig.length === 11 ? { chave: dig, tipo } : { chave: t, tipo, erro: 'CPF tem 11 números' };
  if (tipo === 'cnpj') return dig.length === 14 ? { chave: dig, tipo } : { chave: t, tipo, erro: 'CNPJ tem 14 números' };
  if (tipo === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? { chave: t.toLowerCase(), tipo } : { chave: t, tipo, erro: 'E-mail inválido' };
  if (tipo === 'aleatoria') return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t) ? { chave: t.toLowerCase(), tipo } : { chave: t, tipo, erro: 'Chave aleatória tem o formato 123e4567-e89b-12d3-a456-426614174000' };
  return { chave: t, tipo, erro: 'Escolha o tipo da chave' };
}

/** Monta o código Pix copia e cola. valor em reais (número) ou null para o cliente digitar. */
function codigo({ chave, nome, cidade, valor, txid, mensagem }) {
  if (!chave || !nome) throw new Error('Cadastre a chave Pix e o nome do recebedor em Ajustes');
  let conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
  const msg = limpo(mensagem, 40);
  if (msg && (conta.length + 4 + msg.length) <= 99) conta += campo('02', msg);
  const tx = semAcento(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  let p = campo('00', '01') + campo('26', conta) + campo('52', '0000') + campo('53', '986');
  if (valor !== null && valor !== undefined && valor > 0) p += campo('54', (Math.round(valor * 100) / 100).toFixed(2));
  p += campo('58', 'BR') + campo('59', limpo(nome, 25).toUpperCase() || 'RECEBEDOR')
     + campo('60', limpo(cidade || 'PIRAPOZINHO', 15).toUpperCase()) + campo('62', campo('05', tx)) + '6304';
  return p + crc16(p);
}

const config = () => (D.estado.pix && typeof D.estado.pix === 'object') ? D.estado.pix : { chave: '', tipo: 'celular', nome: '', cidade: 'Pirapozinho' };
const pronto = () => { const c = config(); return !!(c.chave && c.nome); };

/** Código Pix do pedido (total do pedido; txid = DOPIRA + número). */
function doPedido(ped) {
  if (!pronto()) return null;
  const t = D.totais(ped);
  if (!(t.total > 0)) return null;
  const c = config(), txid = `DOPIRA${ped.num}`;
  return { codigo: codigo({ chave: c.chave, nome: c.nome, cidade: c.cidade, valor: t.total, txid, mensagem: `Pedido ${ped.num} Dopira` }), valor: t.total, txid, parcial: !t.completo };
}

/** QR Code em SVG (nítido em qualquer tamanho). Usa a biblioteca qrcode-generator (MIT) em js/vendor. */
function qrSVG(texto, tam = 240) {
  const qr = qrcode(0, 'M'); qr.addData(texto); qr.make();
  const n = qr.getModuleCount(), m = 4, total = n + m * 2;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + m} ${y + m}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${total} ${total}" width="${tam}" height="${tam}" role="img" aria-label="QR Code do Pix" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

window.Pix = { TIPOS, crc16, normalizarChave, codigo, config, pronto, doPedido, qrSVG };
})();
