const CACHE='quvoto-shell-v16';
const OFFLINE='/offline.html';
const APP='/app';
const LOGO='/quvoto-logo.jpg?v=18';

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.add(OFFLINE).catch(()=>{});
    await cache.add(LOGO).catch(()=>{});
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

  // Never cache the manifest or install metadata. This prevents a stale
  // manifest from blocking reinstall after the app has been deleted.
  if(url.pathname==='/manifest.webmanifest' || url.pathname==='/sw.js'){
    event.respondWith(fetch(req,{cache:'no-store'}));
    return;
  }

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        return await fetch(req,{cache:'no-store'});
      }catch{
        const cache=await caches.open(CACHE);
        return (await cache.match(req)) || (await cache.match(OFFLINE));
      }
    })());
  }
});