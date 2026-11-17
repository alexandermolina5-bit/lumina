const CACHE='lumina-local-20261118-v4';
const FILES=['./','./index.html','./local.js','./local.js?v=payments3','./local.css','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('lumina-local-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const scope=new URL(self.registration.scope);if(!url.pathname.startsWith(scope.pathname))return;
  // Cache only the application files; patient records remain in IndexedDB.
  if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));return}
  const relative='./'+url.pathname.slice(scope.pathname.length);
  if(FILES.includes(relative))event.respondWith(caches.match(event.request).then(saved=>saved||fetch(event.request)));
});
