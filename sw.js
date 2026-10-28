// Dopira Defumados: deixa o app funcionando sem internet depois da primeira visita.
const VERSAO = 'dopira-v7';
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
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => /^dopira-v\d/.test(k) && k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (new URL(req.url).pathname.includes('/admin/')) return; // o app de gestão cuida do próprio cache
  // página: tenta a rede primeiro (pega a versão nova), cai no cache se estiver offline
  if (req.mode === 'navigate') {
    // só a página do site entra no cache (o app de gestão, em admin/, tem o próprio cache)
    const doSite = !new URL(req.url).pathname.includes('/admin/');
    e.respondWith(fetch(req).then(r => { if (doSite && r.ok) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put('./index.html', cp)); } return r; }).catch(() => doSite ? caches.match('./index.html') : caches.match(req)));
    return;
  }
  // fotos, vídeo e ícones: cache primeiro
  e.respondWith(caches.match(req).then(c => c || fetch(req).then(r => { if (r.ok && r.status === 200) { const cp = r.clone(); caches.open(VERSAO).then(ca => ca.put(req, cp)); } return r; })));
});
