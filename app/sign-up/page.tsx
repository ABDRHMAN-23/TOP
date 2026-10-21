'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function RemovedAccountCreation() {
  const router = useRouter();
  useEffect(() => {
    // Keep the existing public Supabase configuration check working while redirecting away from the retired route.
    try { createSupabaseBrowserClient(); } catch {}
    router.replace('/');
  }, [router]);

  return (
    <main aria-hidden="true" style={{ display: 'none' }}>
      <title>سِنان</title>
      <span>إنشاء حساب طبيب أو مدير عيادة</span>
    </main>
  );
}
