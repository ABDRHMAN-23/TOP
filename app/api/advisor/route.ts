import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sourcesForMarket } from '@/lib/advisor/market-sources';
import { findUKMarketData } from '@/lib/advisor/uk-market-data';
import { comparePriceOffers, searchProductPrices, getBuildWatchPriceHistory } from '@/lib/advisor/price-intelligence';

async function getFx(base: string, quote: string) {
  if (!base || !quote || base === quote) return { base, date: new Date().toISOString().slice(0, 10), rates: { [quote]: 1 } };
  const response = await fetch('https://api.frankfurter.app/latest?from=' + encodeURIComponent(base) + '&to=' + encodeURIComponent(quote), { cache: 'no-store' });
  if (!response.ok) return null;
  const data = await response.json();
  return { base: String(data.base || base), date: String(data.date || ''), rates: data.rates || {} };
}

async function askGemma(prompt: string) {
  const url = process.env.GEMMA_API_URL;
  if (!url) throw new Error('The QUVOTO Advisor AI is not configured yet. Add GEMMA_API_URL and GEMMA_API_KEY in the server environment.');
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (process.env.GEMMA_API_KEY) headers.Authorization = 'Bearer ' + process.env.GEMMA_API_KEY;
  const system = ['You are QUVOTO Advisor, a professional quoting and pricing assistant for contractors.','The default market is the United Kingdom unless the user specifies another market.','Never invent live prices, exchange rates, regulations, suppliers, or sources.','Use only supplied market data, commercial product prices, price comparisons, and quote history as factual inputs.','A market source can provide an index or trend without providing a retail product price. Never turn an index into a product price.','Commercial product prices must retain their retailer, URL, observed date, currency and unit.','If a requested product price is not supplied by a connected source, explicitly say it was not available and do not fabricate one.','Only describe an offer as the lowest comparable offer when QUVOTO supplied at least two directly comparable offers with the same currency and unit.','Do not treat a cheaper product with a different size, pack, unit, or specification as a comparable winner.','Distinguish sourced facts from estimates and recommendations.','For UK work, use GBP and metric units by default. Do not invent a VAT rate.','Return concise, practical advice for a working contractor.','Return JSON only with keys: answer, warnings, actions, facts, confidence.','warnings/actions/facts must be arrays of strings; confidence must be low, medium, or high.'].join('\\n');
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: process.env.GEMMA_MODEL || 'gemma-4-31b-it', temperature: 0.1, response_format: { type: 'json_object' }, system, prompt, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }) });
  if (!response.ok) throw new Error('The Advisor AI provider returned an error.');
  const raw = await response.json();
  let payload = raw?.output ?? raw?.text ?? raw?.response ?? raw?.choices?.[0]?.message?.content ?? raw;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload.trim()); } catch { throw new Error('The Advisor returned invalid structured data.'); } }
  return { answer: String(payload?.answer || ''), warnings: Array.isArray(payload?.warnings) ? payload.warnings.map(String) : [], actions: Array.isArray(payload?.actions) ? payload.actions.map(String) : [], facts: Array.isArray(payload?.facts) ? payload.facts.map(String) : [], confidence: ['low','medium','high'].includes(payload?.confidence) ? payload.confidence : 'low' };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to use QUVOTO Advisor.' }, { status: 401 });
    const body = await req.json();
    const question = String(body?.question || '').trim();
    if (!question) return NextResponse.json({ error: 'Ask the Advisor a question.' }, { status: 400 });
    const market = String(body?.market || 'United Kingdom').trim();
    const currency = String(body?.currency || 'GBP').trim().toUpperCase();
    const { data: business } = await supabase.from('business_profiles').select('business_name,default_currency,address').eq('user_id', user.id).maybeSingle();
    const { data: quotes } = await supabase.from('quotes').select('quote_number,client_name,items,subtotal,total,currency,status,created_at').eq('user_id', user.id).order('created_at',{ ascending:false }).limit(20);
    const fx = currency !== 'GBP' ? await getFx('GBP', currency) : { base:'GBP', date:new Date().toISOString().slice(0,10), rates:{ GBP:1 } };
    const isUk = /^(united kingdom|uk|great britain)$/i.test(market);
    const marketSources = sourcesForMarket(market);
    const marketData = isUk ? findUKMarketData(question) : [];
    const productPrices = isUk ? await searchProductPrices(question, market, currency) : [];
    const priceComparisons = comparePriceOffers(productPrices);
    const context = { business: business || {}, market, requested_currency: currency, fx, quote_history: quotes || [], verified_market_sources: marketSources, verified_market_data: marketData, commercial_product_prices: productPrices, price_comparisons: priceComparisons,
  price_history: priceHistory, product_price_status: process.env.PRICE_INTELLIGENCE_API_URL ? 'connected' : 'not_connected', requested_quantity: requiredQuantity, requested_unit: requiredUnit, question };
    const result = await askGemma(JSON.stringify(context));
    return NextResponse.json({ ...result, market, currency, fx_source: 'Frankfurter reference rates', fx_date: fx?.date || null, sources: marketSources, market_data: marketData, product_prices: productPrices, price_comparisons: priceComparisons, requested_quantity: requiredQuantity, requested_unit: requiredUnit, product_price_connected: Boolean(process.env.PRICE_INTELLIGENCE_API_URL) || isUk });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Advisor request failed.' }, { status: 500 }); }
}