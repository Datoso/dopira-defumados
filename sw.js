// Dopira Defumados: deixa o app funcionando sem internet depois da primeira visita.
const VERSAO = 'dopira-v4';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './img/hero.jpg', './img/panceta.jpg', './img/panceta-2.jpg', './img/linguica.jpg', './img/linguica-arte.jpg', './img/logo.png', './img/kit.jpg',
  './video/hero.mp4'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => Promise.all(ARQUIVOS.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // página: tenta a rede primeiro (pega a versão nova), cai no cache se estiver offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { caches.open(VERSAO).then(c => c.put('./index.html', r.clone())); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  // fotos, vídeo e ícones: cache primeiro
  e.respondWith(caches.match(req).then(c => c || fetch(req).then(r => { if (r.ok && r.status === 200) { const cp = r.clone(); caches.open(VERSAO).then(ca => ca.put(req, cp)); } return r; })));
});
