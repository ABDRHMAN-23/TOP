const CACHE='quvoto-shell-v15';
const OFFLINE='/offline.html';
const APP='/app';
const LOGO='/quvoto-logo.jpg?v=18';

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
        const response=await fetch(req,{cache:'no-store'});
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
