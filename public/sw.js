self.addEventListener('push',event=>{
  let data={title:'QUVOTO',body:'You have a new update.',link:'/'};
  try{if(event.data)data={...data,...event.data.json()}}catch(_){}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/icon.svg',badge:'/icon.svg',data:{link:data.link||'/'},tag:data.tag||'quvoto-update',renotify:true}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification?.data?.link||'/';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if('focus' in client){client.navigate(url);return client.focus();}}
    return clients.openWindow(url);
  }));
});