'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function InstallPrompt(){
  const [deferred,setDeferred]=useState<any>(null);
  const [installed,setInstalled]=useState(false);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    const standalone=window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone===true;
    if(standalone){setInstalled(true);return;}
    const handler=(e:any)=>{e.preventDefault();setDeferred(e);setVisible(true)};
    window.addEventListener('beforeinstallprompt',handler);
    const onInstalled=()=>{setInstalled(true);setVisible(false);setDeferred(null)};
    window.addEventListener('appinstalled',onInstalled);
    if(!localStorage.getItem('quvoto_install_dismissed'))setVisible(true);
    return()=>{window.removeEventListener('beforeinstallprompt',handler);window.removeEventListener('appinstalled',onInstalled)};
  },[]);
  const install=async()=>{
    if(!deferred){setVisible(false);return;}
    deferred.prompt();
    const result=await deferred.userChoice;
    if(result?.outcome==='accepted'){setInstalled(true);setVisible(false);}
    else{setVisible(false);localStorage.setItem('quvoto_install_dismissed','1')}
  };
  if(installed||!visible)return null;
  return <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl sm:bottom-6">
    <div className="flex items-center gap-3 rounded-2xl border border-[#1769E0]/15 bg-white/95 p-3 shadow-xl backdrop-blur sm:p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]"><Download size={20}/></div>
      <div className="min-w-0 flex-1"><p className="text-sm font-black text-[#0A1E3D]">Keep QUVOTO one tap away</p><p className="mt-0.5 text-xs leading-5 text-slate-500"><Smartphone size={12} className="mr-1 inline"/>Install QUVOTO like an app on your phone or desktop, so you never need to remember the website.</p></div>
      <button onClick={install} className="shrink-0 rounded-xl bg-[#1769E0] px-3.5 py-2.5 text-xs font-black text-white">Install</button>
      <button onClick={()=>{setVisible(false);localStorage.setItem('quvoto_install_dismissed','1')}} aria-label="Dismiss install prompt" className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={17}/></button>
    </div>
  </div>;
}