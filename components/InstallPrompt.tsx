'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone, MoreVertical } from 'lucide-react';

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
};

export default function InstallPrompt(){
  const [deferred,setDeferred]=useState<DeferredPrompt|null>(null);
  const [installed,setInstalled]=useState(false);
  const [visible,setVisible]=useState(false);
  const [ios,setIos]=useState(false);
  const [fallback,setFallback]=useState(false);

  useEffect(()=>{
    let mounted=true;

    const checkInstalled=()=>{
      const standalone=window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone===true ||
        document.referrer.startsWith('android-app://');
      if(mounted)setInstalled(standalone);
      return standalone;
    };

    if(checkInstalled())return;

    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    setIos(isIOS);

    const handler=(e:Event)=>{
      e.preventDefault();
      const prompt=e as DeferredPrompt;
      if(!mounted)return;
      setDeferred(prompt);
      setFallback(false);
      setVisible(true);
    };

    const onInstalled=()=>{
      setInstalled(true);
      setVisible(false);
      setDeferred(null);
      setFallback(false);
      localStorage.removeItem('quvoto_install_dismissed');
    };

    window.addEventListener('beforeinstallprompt',handler as EventListener);
    window.addEventListener('appinstalled',onInstalled);
    window.addEventListener('pageshow',checkInstalled);
    document.addEventListener('visibilitychange',checkInstalled);

    // Register the service worker once. A registered SW makes the PWA lifecycle
    // deterministic and lets a deleted installation become installable again.
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js',{scope:'/'})
        .then(reg=>reg.update().catch(()=>{}))
        .catch(()=>{});
    }

    // Do not leave a dead disabled Install button when Chromium has not exposed
    // beforeinstallprompt yet (common after an uninstall). Show browser-menu
    // instructions instead.
    const timer=window.setTimeout(()=>{
      if(!mounted || checkInstalled())return;
      setFallback(true);
      setVisible(true);
    },1800);

    return()=>{
      mounted=false;
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt',handler as EventListener);
      window.removeEventListener('appinstalled',onInstalled);
      window.removeEventListener('pageshow',checkInstalled);
      document.removeEventListener('visibilitychange',checkInstalled);
    };
  },[]);

  const install=async()=>{
    if(ios){
      setVisible(false);
      return;
    }
    if(!deferred){
      setFallback(true);
      setVisible(true);
      return;
    }
    try{
      await deferred.prompt();
      const result=await deferred.userChoice;
      setDeferred(null);
      if(result?.outcome==='accepted'){
        setInstalled(true);
        setVisible(false);
        setFallback(false);
      }else{
        setVisible(false);
      }
    }catch{
      setDeferred(null);
      setFallback(true);
      setVisible(true);
    }
  };

  const dismiss=()=>{
    setVisible(false);
    localStorage.setItem('quvoto_install_dismissed','1');
  };

  if(installed)return null;

  if(!visible) return (
    <button onClick={()=>setVisible(true)} className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-[#1769E0]/20 bg-white px-3.5 py-2.5 text-xs font-black text-[#0A1E3D] shadow-lg hover:border-[#1769E0]">
      <Download size={15} className="text-[#1769E0]"/> Install QUVOTO
    </button>
  );

  return <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl sm:bottom-6">
    <div className="flex items-center gap-3 rounded-2xl border border-[#1769E0]/15 bg-white/95 p-3 shadow-xl backdrop-blur sm:p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]"><Download size={20}/></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#0A1E3D]">Install QUVOTO</p>
        {ios ? (
          <p className="mt-0.5 text-xs leading-5 text-slate-500"><Smartphone size={12} className="mr-1 inline"/>Tap <b>Share</b>, then <b>Add to Home Screen</b>.</p>
        ) : fallback && !deferred ? (
          <p className="mt-0.5 text-xs leading-5 text-slate-500"><MoreVertical size={12} className="mr-1 inline"/>If an older QUVOTO app is still installed, uninstall it from your home screen first. Then open this page in Chrome, refresh once, and use the browser menu <b>⋮</b> → <b>Install app</b> or <b>Add to Home screen</b>.</p>
        ) : (
          <p className="mt-0.5 text-xs leading-5 text-slate-500">If you previously installed QUVOTO, remove the old QUVOTO icon first, then reopen this page to install the current version.</p>
        )}
      </div>
      {!ios && deferred && <button onClick={install} className="shrink-0 rounded-xl bg-[#1769E0] px-3.5 py-2.5 text-xs font-black text-white">Install</button>}
      {ios && <button onClick={install} className="shrink-0 rounded-xl bg-[#1769E0] px-3.5 py-2.5 text-xs font-black text-white">Got it</button>}
      {!ios && !deferred && <button onClick={install} className="shrink-0 rounded-xl border border-[#1769E0]/20 px-3.5 py-2.5 text-xs font-black text-[#1769E0]">How</button>}
      <button onClick={dismiss} aria-label="Dismiss install prompt" className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={17}/></button>
    </div>
  </div>;
}