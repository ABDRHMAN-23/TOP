self.addEventListener('install',event=>{
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate',event=>{
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push',event=>{
  let data={title:'QUVOTO',body:'You have a new QUVOTO update.',link:'/'};
  try{if(event.data)data={...data,...event.data.json()}}catch(_){}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,
    icon:'/icon.svg',
    badge:'/icon.svg',
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