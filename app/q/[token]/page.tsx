import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import DownloadPdf from './DownloadPdf';

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let quote: any = null;
  let business: any = null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('quotes')
      .select('user_id,quote_number,client_name,client_address,items,subtotal,vat_rate,vat_amount,discount,total,currency,status,created_at')
      .eq('public_token', token)
      .maybeSingle();
    quote = data;
    if (quote?.user_id) {
      const { data: profile } = await admin
        .from('business_profiles')
        .select('business_name,logo_url,phone,email,address')
        .eq('user_id', quote.user_id)
        .maybeSingle();
      business = profile;
    }
  } catch {}

  if (!quote) notFound();
  const items = Array.isArray(quote.items) ? quote.items : [];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-xl">
        <div className="border-b p-7 sm:p-10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-bold text-blue-600">QUOTE</p>
              <h1 className="mt-2 text-3xl font-black">{quote.quote_number}</h1>
              {business?.business_name && <p className="mt-2 font-bold">{business.business_name}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-3">
              {business?.logo_url ? <img src={business.logo_url} alt={business.business_name || 'Business logo'} className="h-14 w-14 rounded-xl object-contain" /> : null}
              <DownloadPdf quote={quote} business={business} />
            </div>
          </div>

          <div className="mt-6 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
            <div>Client: <span className="font-semibold text-slate-800">{quote.client_name || '—'}</span></div>
            <div>Issued: <span className="font-semibold text-slate-800">{new Date(quote.created_at).toLocaleDateString()}</span></div>
          </div>
        </div>

        <div className="p-7 sm:p-10">
          <div className="overflow-hidden rounded-2xl border">
            <div className="grid grid-cols-[1fr_80px_110px] gap-3 bg-slate-50 p-4 text-xs font-bold uppercase text-slate-500">
              <span>Description</span><span>Qty</span><span className="text-right">Amount</span>
            </div>
            {items.map((item: any, index: number) => (
              <div key={index} className="grid grid-cols-[1fr_80px_110px] gap-3 border-t p-4 text-sm">
                <span>{item.description || 'Item'}</span>
                <span>{item.quantity || 0} {item.unit || ''}</span>
                <span className="text-right font-semibold">{quote.currency} {(Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="ml-auto mt-6 max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{quote.currency} {Number(quote.subtotal).toFixed(2)}</span></div>
            {Number(quote.discount) > 0 && <div className="flex justify-between"><span>Discount</span><span>-{quote.currency} {Number(quote.discount).toFixed(2)}</span></div>}
            {Number(quote.vat_amount) > 0 && <div className="flex justify-between"><span>VAT ({quote.vat_rate}%)</span><span>{quote.currency} {Number(quote.vat_amount).toFixed(2)}</span></div>}
            <div className="flex justify-between border-t pt-3 text-xl font-black"><span>Total</span><span>{quote.currency} {Number(quote.total).toFixed(2)}</span></div>
          </div>

          {(business?.phone || business?.email || business?.address) && (
            <div className="mt-10 border-t pt-5 text-sm text-slate-500">
              <div className="font-bold text-slate-800">{business.business_name}</div>
              {business.address && <div>{business.address}</div>}
              {business.phone && <div>{business.phone}</div>}
              {business.email && <div>{business.email}</div>}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
