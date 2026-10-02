const CACHE='quvoto-shell-v14';
const OFFLINE='/offline.html';
const APP='/app';
const LOGO='/quvoto-logo.jpg?v=17';

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.add(OFFLINE);
    await cache.add(LOGO).catch(()=>{});
    await cache.add(APP).catch(()=>{});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(req);
        if(url.pathname==='/app'){
          const cache=await caches.open(CACHE);
          await cache.put(APP,response.clone());
        }
        return response;
      }catch{
        const cache=await caches.open(CACHE);
        return (await cache.match(req)) || (await cache.match(APP)) || (await cache.match(OFFLINE));
      }
    })());
  }
});

self.addEventListener('push',event=>{
  let data={title:'QUVOTO',body:'You have a new QUVOTO update.',link:'/'};
  try{if(event.data)data={...data,...event.data.json()}}catch(_){}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,
    icon:LOGO,
    badge:LOGO,
    data:{link:data.link||'/'},
    tag:data.tag||'quvoto-update',
    renotify:true
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification?.data?.link||'/',self.location.origin).href;
  event.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
      const existing=list.find(client=>new URL(client.url).origin===self.location.origin);
      if(existing){
        if('navigate' in existing)existing.navigate(target);
        if('focus' in existing)return existing.focus();
      }
      return clients.openWindow(target);
    })
  );
});