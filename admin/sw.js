// Sistema Dopira: funciona sem internet depois da primeira visita.
// Página e scripts: rede primeiro (pega a versão nova), cache se estiver offline.
const VERSAO = 'dopira-gestao-v6';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest',
  './css/base.css', './css/inicio.css', './css/pedidos.css', './css/catalogo.css', './css/promocoes.css',
  './js/dados.js', './js/ui.js', './js/vendor/qrcode.js', './js/pix.js', './js/inicio.js', './js/pedidos.js', './js/catalogo.js', './js/promocoes.js', './js/ajustes.js', './js/app.js',
  './fonts/bsd.woff2', './fonts/literata.woff2', './fonts/literata-i.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png', './img/sistema-logo.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => Promise.all(ARQUIVOS.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('dopira-gestao') && k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // previsão do tempo etc. vão direto pra rede
  const rede = () => fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); } return r; });
  if (req.mode === 'navigate') { e.respondWith(rede().catch(() => caches.match('./index.html'))); return; }
  if (/\.(js|css|webmanifest)$/.test(url.pathname)) { e.respondWith(rede().catch(() => caches.match(req))); return; }
  // imagens e fontes: mostra o que tem no cache e atualiza por trás (foto trocada aparece na próxima abertura)
  e.respondWith(caches.match(req).then(c => { const n = rede().catch(() => c); return c || n; }));
});
