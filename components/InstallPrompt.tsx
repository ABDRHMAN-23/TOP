'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function InstallPrompt(){
  const [deferred,setDeferred]=useState<any>(null);
  const [installed,setInstalled]=useState(false);
  const [visible,setVisible]=useState(false);
  const [ios,setIos]=useState(false);

  useEffect(()=>{
    const standalone=window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone===true;
    if(standalone){setInstalled(true);return;}

    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    setIos(isIOS);

    const handler=(e:any)=>{
      e.preventDefault();
      setDeferred(e);
      if(!localStorage.getItem('quvoto_install_dismissed')) setVisible(true);
    };
    const onInstalled=()=>{
      setInstalled(true);
      setVisible(false);
      setDeferred(null);
      localStorage.removeItem('quvoto_install_dismissed');
    };

    window.addEventListener('beforeinstallprompt',handler);
    window.addEventListener('appinstalled',onInstalled);

    // iOS has no beforeinstallprompt. Keep a small, non-blocking entry point.
    if(isIOS && !localStorage.getItem('quvoto_install_dismissed')) setVisible(true);

    return()=>{
      window.removeEventListener('beforeinstallprompt',handler);
      window.removeEventListener('appinstalled',onInstalled);
    };
  },[]);

  const install=async()=>{
    if(ios){
      setVisible(false);
      localStorage.setItem('quvoto_install_dismissed','1');
      return;
    }
    if(!deferred)return;
    deferred.prompt();
    const result=await deferred.userChoice;
    setDeferred(null);
    if(result?.outcome==='accepted'){
      setInstalled(true);
      setVisible(false);
      localStorage.removeItem('quvoto_install_dismissed');
    }else{
      setVisible(false);
      localStorage.setItem('quvoto_install_dismissed','1');
    }
  };

  const reopen=()=>setVisible(true);
  if(installed)return null;

  if(!visible) return <button onClick={reopen} className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-[#1769E0]/20 bg-white px-3.5 py-2.5 text-xs font-black text-[#0A1E3D] shadow-lg hover:border-[#1769E0]"><Download size={15} className="text-[#1769E0]"/> Install QUVOTO</button>;

  return <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl sm:bottom-6">
    <div className="flex items-center gap-3 rounded-2xl border border-[#1769E0]/15 bg-white/95 p-3 shadow-xl backdrop-blur sm:p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]"><Download size={20}/></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#0A1E3D]">Keep QUVOTO one tap away</p>
        {ios
          ? <p className="mt-0.5 text-xs leading-5 text-slate-500"><Smartphone size={12} className="mr-1 inline"/>On iPhone/iPad: tap <b>Share</b>, then <b>Add to Home Screen</b>.</p>
          : <p className="mt-0.5 text-xs leading-5 text-slate-500"><Smartphone size={12} className="mr-1 inline"/>Install QUVOTO like an app on your phone or desktop, so you never need to remember the website.</p>}
      </div>
      {!ios && <button onClick={install} disabled={!deferred} className="shrink-0 rounded-xl bg-[#1769E0] px-3.5 py-2.5 text-xs font-black text-white disabled:opacity-50">Install</button>}
      {ios && <button onClick={install} className="shrink-0 rounded-xl bg-[#1769E0] px-3.5 py-2.5 text-xs font-black text-white">Got it</button>}
      <button onClick={()=>{setVisible(false);localStorage.setItem('quvoto_install_dismissed','1')}} aria-label="Dismiss install prompt" className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={17}/></button>
    </div>
  </div>;
}
