// No patient records, private images or API responses are cached on shared phones.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let payload={};try{payload=event.data.json()}catch{}
  event.waitUntil(self.registration.showNotification('LÚMINA · Recordatorio',{body:payload.body||'Tienes un aviso de tu agenda.',tag:payload.tag||'lumina',icon:'./icon.svg',data:{url:'./'}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.openWindow(new URL('./',self.registration.scope).href));});
