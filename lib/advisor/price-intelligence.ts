export type PriceQuote = {
  productName: string;
  retailer: string;
  url: string;
  price: number;
  currency: string;
  unit?: string;
  observedAt: string;
  sourceType: 'retailer_api' | 'merchant_feed' | 'approved_aggregator';
  confidence: 'high' | 'medium' | 'low';
};

type ProviderPayload = {
  prices?: unknown[];
  data?: unknown[];
  results?: unknown[];
};

function normalize(item: any): PriceQuote | null {
  const price = Number(item?.price ?? item?.current_price ?? item?.price_amount);
  const name = String(item?.productName ?? item?.product_name ?? item?.name ?? '').trim();
  const retailer = String(item?.retailer ?? item?.merchant ?? item?.store ?? '').trim();
  const url = String(item?.url ?? item?.product_url ?? item?.link ?? '').trim();
  if (!name || !retailer || !url || !Number.isFinite(price) || price < 0) return null;
  return {
    productName: name,
    retailer,
    url,
    price,
    currency: String(item?.currency ?? 'GBP').toUpperCase(),
    unit: item?.unit ? String(item.unit) : undefined,
    observedAt: String(item?.observedAt ?? item?.observed_at ?? item?.checkedAt ?? new Date().toISOString()),
    sourceType: ['retailer_api','merchant_feed','approved_aggregator'].includes(item?.sourceType) ? item.sourceType : 'approved_aggregator',
    confidence: ['high','medium','low'].includes(item?.confidence) ? item.confidence : 'medium',
  };
}

export async function searchProductPrices(query: string, market: string, currency: string): Promise<PriceQuote[]> {
  const endpoint = process.env.PRICE_INTELLIGENCE_API_URL;
  if (!endpoint) return [];
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (process.env.PRICE_INTELLIGENCE_API_KEY) headers.Authorization = 'Bearer ' + process.env.PRICE_INTELLIGENCE_API_KEY;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, market, currency, limit: 8 }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('The connected price intelligence provider returned an error.');
  const payload = await response.json() as ProviderPayload | unknown[];
  const raw = Array.isArray(payload) ? payload : payload?.prices ?? payload?.data ?? payload?.results ?? [];
  return raw.map(normalize).filter((x): x is PriceQuote => Boolean(x)).slice(0, 8);
}

export const PRICE_INTELLIGENCE_CONFIGURED = Boolean(process.env.PRICE_INTELLIGENCE_API_URL);
