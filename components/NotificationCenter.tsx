'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing, Check, X } from 'lucide-react';

function urlBase64ToUint8Array(base64String:string){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=window.atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

export default function NotificationCenter(){
  const [items,setItems]=useState<any[]>([]);
  const [open,setOpen]=useState(false);
  const [permission,setPermission]=useState<NotificationPermission|'unsupported'>('default');
  const [prompt,setPrompt]=useState(false);
  const [busy,setBusy]=useState(false);
  const [serverUnread,setServerUnread]=useState(0);
  const load=async()=>{const r=await fetch('/api/notifications',{cache:'no-store'});if(r.ok){const d=await r.json();setItems(d.notifications||[]);setServerUnread(Number(d.unreadCount||0))}};

  useEffect(()=>{
    if(typeof window==='undefined')return;
    setPermission('Notification' in window?Notification.permission:'unsupported');
    load();
    const refreshTimer=window.setInterval(load,30000);
    const onVisible=()=>{if(document.visibilityState==='visible')load()};
    document.addEventListener('visibilitychange',onVisible);
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
    const vapidKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const standalone=window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone===true;
    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    const pushReady=!!vapidKey && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window && (!isIOS || standalone);
    if(pushReady && Notification.permission==='default'&&!localStorage.getItem('quvoto_notification_prompt_seen')){
      setPrompt(true);localStorage.setItem('quvoto_notification_prompt_seen','1');
    }
    if(pushReady && Notification.permission==='granted') ensureSubscription();
    return()=>{window.clearInterval(refreshTimer);document.removeEventListener('visibilitychange',onVisible)};
  },[]);

  const ensureSubscription=async()=>{
    const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if(!key||!('serviceWorker' in navigator)||!('PushManager' in window))return;
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)});
    await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON()})});
  };

  const enable=async()=>{
    setBusy(true);
    try{
      if(!('Notification' in window)){setPermission('unsupported');return}
      const p=await Notification.requestPermission();setPermission(p);setPrompt(false);
      if(p!=='granted'||!('serviceWorker' in navigator)||!('PushManager' in window))return;
      await ensureSubscription();
    }finally{setBusy(false)}
  };

  const markAll=async()=>{await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({all:true})});setItems(x=>x.map(n=>({...n,read_at:n.read_at||new Date().toISOString()})));setServerUnread(0)};
  const mark=async(n:any)=>{if(!n.read_at){await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:n.id})});setItems(x=>x.map(i=>i.id===n.id?{...i,read_at:new Date().toISOString()}:i));setServerUnread(v=>Math.max(0,v-1))}};
  const openNotification=async(e:React.MouseEvent,n:any)=>{if(!n.read_at){e.preventDefault();await mark(n);if(n.link)window.location.assign(n.link)}};
  const unread=serverUnread;
  const canEnable = permission==='default' && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  return <>
    {prompt&&<div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-[#1769E0]/20 bg-white p-5 shadow-2xl sm:left-auto sm:right-6"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]"><BellRing size={21}/></div><div className="min-w-0 flex-1"><p className="font-black text-[#0A1E3D]">Never miss a QUVOTO update.</p><p className="mt-1 text-sm leading-5 text-slate-500">Get fast alerts when your quote is created, viewed, accepted, or you unlock a referral reward.</p><div className="mt-4 flex gap-2"><button disabled={busy} onClick={enable} className="rounded-xl bg-[#1769E0] px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">{busy?'Enabling…':'Turn on notifications'}</button><button onClick={()=>setPrompt(false)} className="rounded-xl border px-3 py-2.5 text-slate-500"><X size={17}/></button></div></div></div></div>}

    <div className="relative"><button onClick={()=>setOpen(v=>!v)} aria-label="Notifications" className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-[#1769E0]"><Bell size={19}/>{unread>0&&<span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#1769E0] px-1.5 py-0.5 text-[10px] font-black text-white">{unread>9?'9+':unread}</span>}</button>
      {open&&<div className="absolute right-0 top-13 z-40 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-4"><div><p className="font-black">Notifications</p><p className="text-xs text-slate-400">{unread?String(unread)+' unread':'You are all caught up'}</p></div>{canEnable&&<button onClick={enable} disabled={busy} className="mr-2 rounded-lg bg-[#1769E0]/10 px-2 py-1 text-[10px] font-black text-[#1769E0]">{busy?'…':'Enable'}</button>}{unread>0&&<button onClick={markAll} className="text-xs font-black text-[#1769E0]">Mark all read</button>}</div><div className="max-h-[420px] overflow-auto">{items.length?items.map(n=><a key={n.id} href={n.link||'#'} onClick={(e)=>openNotification(e,n)} className={'block border-b p-4 hover:bg-slate-50 '+(!n.read_at?'bg-[#1769E0]/5':'')}><div className="flex gap-3"><div className="mt-0.5 text-[#1769E0]"><Bell size={16}/></div><div className="min-w-0"><p className="font-black text-sm">{n.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{n.body}</p><time className="mt-2 block text-[10px] font-bold text-slate-400">{new Date(n.created_at).toLocaleString()}</time></div></div></a>):<div className="p-8 text-center"><Check className="mx-auto text-emerald-500" size={25}/><p className="mt-2 font-black">All caught up.</p><p className="mt-1 text-xs text-slate-400">Your QUVOTO updates will appear here.</p></div>}</div></div>}
    </div>
  </>;
}
