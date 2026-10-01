export type PriceQuote = {
  productName: string;
  retailer: string;
  url: string;
  price: number;
  currency: string;
  unit?: string;
  packQuantity?: number;
  observedAt: string;
  sourceType: 'retailer_api' | 'merchant_feed' | 'approved_aggregator';
  confidence: 'high' | 'medium' | 'low';
};

export type PriceComparison = {
  productName: string;
  comparable: boolean;
  reason?: string;
  currency?: string;
  unit?: string;
  requiredQuantity?: number;
  requiredUnit?: string;
  offers: PriceQuote[];
  lowest?: PriceQuote;
  highest?: PriceQuote;
  average?: number;
  spreadPercent?: number;
  lowestPurchaseTotal?: number;
  lowestPackCount?: number;
};

type ProviderPayload = { prices?: unknown[]; data?: unknown[]; results?: unknown[] };

function normalize(item: any): PriceQuote | null {
  const price = Number(item?.price ?? item?.current_price ?? item?.price_amount);
  const name = String(item?.productName ?? item?.product_name ?? item?.name ?? '').trim();
  const retailer = String(item?.retailer ?? item?.merchant ?? item?.store ?? '').trim();
  const url = String(item?.url ?? item?.product_url ?? item?.link ?? '').trim();
  const packQuantity = Number(item?.packQuantity ?? item?.pack_quantity ?? item?.quantity_per_pack ?? item?.unitsPerPack);
  if (!name || !retailer || !url || !Number.isFinite(price) || price < 0) return null;
  return {
    productName: name,
    retailer,
    url,
    price,
    currency: String(item?.currency ?? 'GBP').toUpperCase(),
    unit: item?.unit ? String(item.unit).trim() : undefined,
    packQuantity: Number.isFinite(packQuantity) && packQuantity > 0 ? packQuantity : undefined,
    observedAt: String(item?.observedAt ?? item?.observed_at ?? item?.checkedAt ?? new Date().toISOString()),
    sourceType: ['retailer_api','merchant_feed','approved_aggregator'].includes(item?.sourceType) ? item.sourceType : 'approved_aggregator',
    confidence: ['high','medium','low'].includes(item?.confidence) ? item.confidence : 'medium',
  };
}

function keyFor(item: PriceQuote) {
  return item.productName.trim().toLowerCase().replace(/\s+/g, ' ') + '|' + (item.unit || '').trim().toLowerCase();
}

export function comparePriceOffers(prices: PriceQuote[], requiredQuantity?: number, requiredUnit?: string): PriceComparison[] {
  const groups = new Map<string, PriceQuote[]>();
  for (const price of prices) {
    const key = keyFor(price);
    const list = groups.get(key) || [];
    list.push(price);
    groups.set(key, list);
  }

  return Array.from(groups.values()).map((offers) => {
    const currencies = new Set(offers.map((x) => x.currency));
    const units = new Set(offers.map((x) => (x.unit || '').trim().toLowerCase()));
    const normalizedRequiredUnit = requiredUnit?.trim().toLowerCase();
    if (currencies.size !== 1 || units.size !== 1 || (normalizedRequiredUnit && !units.has(normalizedRequiredUnit))) {
      return { productName: offers[0].productName, comparable: false, reason: 'Offers use different currencies, units, or requested units, so QUVOTO will not rank them as directly comparable.', offers };
    }

    const sorted = [...offers].sort((a, b) => a.price - b.price);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const average = sorted.reduce((sum, item) => sum + item.price, 0) / sorted.length;
    const spreadPercent = lowest.price > 0 ? ((highest.price - lowest.price) / lowest.price) * 100 : undefined;
    let lowestPurchaseTotal: number | undefined;
    let lowestPackCount: number | undefined;

    if (requiredQuantity && requiredQuantity > 0 && lowest.packQuantity && lowest.unit) {
      lowestPackCount = Math.ceil(requiredQuantity / lowest.packQuantity);
      lowestPurchaseTotal = lowestPackCount * lowest.price;
    }

    return { productName: lowest.productName, comparable: sorted.length >= 2, currency: lowest.currency, unit: lowest.unit, requiredQuantity, requiredUnit, offers: sorted, lowest, highest, average, spreadPercent, lowestPurchaseTotal, lowestPackCount };
  });
}

export async function searchProductPrices(query: string, market: string, currency: string): Promise<PriceQuote[]> {
  const endpoint = process.env.PRICE_INTELLIGENCE_API_URL;
  if (!endpoint) return [];
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (process.env.PRICE_INTELLIGENCE_API_KEY) headers.Authorization = 'Bearer ' + process.env.PRICE_INTELLIGENCE_API_KEY;
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, market, currency, limit: 8 }), cache: 'no-store' });
  if (!response.ok) throw new Error('The connected price intelligence provider returned an error.');
  const payload = await response.json() as ProviderPayload | unknown[];
  const raw = Array.isArray(payload) ? payload : payload?.prices ?? payload?.data ?? payload?.results ?? [];
  return raw.map(normalize).filter((x): x is PriceQuote => Boolean(x)).slice(0, 8);
}

export const PRICE_INTELLIGENCE_CONFIGURED = Boolean(process.env.PRICE_INTELLIGENCE_API_URL);
