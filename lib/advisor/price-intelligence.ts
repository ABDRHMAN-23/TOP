export type PriceQuote = {
  productName: string;
  retailer: string;
  url: string;
  price: number;
  currency: string;
  unit?: string;
  packQuantity?: number;
  purchaseTotal?: number;
  purchasePackCount?: number;
  effectiveUnitPrice?: number;
  shipping?: number;
  tax?: number;
  totalWithExtras?: number;
  observedAt: string;
  sourceType: 'retailer_api' | 'merchant_feed' | 'approved_aggregator';
  confidence: 'high' | 'medium' | 'low';
  availability?: 'in_stock' | 'out_of_stock' | 'unknown';
};

export type PriceHistoryPoint = { date: string; retailer: string; price: number; currency: string; inStock?: boolean; };

export type PriceHistorySummary = { productName: string; currency: string; points: PriceHistoryPoint[]; current?: number; previous?: number; changePercent?: number; direction: 'up'|'down'|'flat'|'unknown'; anomaly: 'high'|'low'|'normal'|'unknown'; averagePrice?: number; lowestPrice?: number; highestPrice?: number; source: string; };

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
  requestedPurchaseTotals?: { retailer: string; packs: number; total: number; currency: string; availability: 'in_stock'|'out_of_stock'|'unknown' }[];
  unavailableOffers?: { retailer: string; reason: string }[];
};

type ProviderPayload = { prices?: unknown[]; data?: unknown[]; results?: unknown[] };

const BUILDWATCH_API_URL = 'https://buildwatch.dev/api/v1';

async function fetchBuildWatch(path: string) {
  const response = await fetch(`${BUILDWATCH_API_URL}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'QUVOTO-Advisor/1.0' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`BuildWatch returned HTTP ${response.status}.`);
  return response.json() as Promise<any>;
}

function parsePackQuantity(unitLabel?: string, productName?: string): number | undefined {
  const text = `${unitLabel || ''} ${productName || ''}`;
  const explicitPack = text.match(/(?:pack|box|roll|coil|bundle)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(m|metres?|meters?|kg|kilograms?|l|litres?|liters?|pcs?|pieces?|units?)\b/i)
    || text.match(/(\d+(?:\.\d+)?)\s*(m|metres?|meters?|kg|kilograms?|l|litres?|liters?)\s*(?:roll|coil|reel|pack|box)\b/i);
  if (!explicitPack) return undefined;
  const value = Number(explicitPack[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function extractSpecs(text: string) {
  const normalized = text.toLowerCase().replace(/×/g, 'x');
  const values = [...normalized.matchAll(/\b\d+(?:\.\d+)?\s*(?:mm|cm|m|kg|g|l|ml|in|inch|inches|ft)\b/g)]
    .map((match) => match[0].replace(/\s+/g, ''));
  return [...new Set(values)].sort();
}

function specMatchScore(query: string, productName: string) {
  const required = extractSpecs(query);
  if (!required.length) return 1;
  const actual = new Set(extractSpecs(productName));
  const matched = required.filter((spec) => actual.has(spec)).length;
  return matched / required.length;
}

async function searchBuildWatchPrices(query: string): Promise<PriceQuote[]> {
  const search = await fetchBuildWatch(`/search?q=${encodeURIComponent(query)}`);
  const results = Array.isArray(search?.results) ? search.results.slice(0, 4) : [];
  const collected: PriceQuote[] = [];

  for (const result of results) {
    if (!result?.slug) continue;
    const data = await fetchBuildWatch(`/products/${encodeURIComponent(result.slug)}`);
    const product = data?.product || {};
    const prices = Array.isArray(data?.prices) ? data.prices : [];
    const productName = String(product?.name || result?.name || query).trim();
    const matchScore = specMatchScore(query, productName);
    if (matchScore < 1) continue;

    for (const offer of prices) {
      const price = Number(offer?.price_inc_vat);
      if (!Number.isFinite(price) || price < 0) continue;
      const unit = String(product?.unit_label || result?.unit_label || '').trim() || undefined;
      const packQuantity = parsePackQuantity(unit, productName);
      collected.push({
        productName,
        retailer: String(offer?.merchant_name || 'BuildWatch merchant').trim(),
        url: String(product?.url || result?.url || `https://buildwatch.dev/products/${encodeURIComponent(result.slug)}`),
        price,
        currency: String(offer?.currency || 'GBP').toUpperCase(),
        unit,
        packQuantity,
        observedAt: String(offer?.scraped_at || new Date().toISOString()),
        sourceType: 'approved_aggregator',
        confidence: 'medium',
        availability: offer?.in_stock === true ? 'in_stock' : offer?.in_stock === false ? 'out_of_stock' : 'unknown',
      });
    }
  }

  return collected.slice(0, 8);
}


function normalize(item: any): PriceQuote | null {
  const price = Number(item?.price ?? item?.current_price ?? item?.price_amount);
  const name = String(item?.productName ?? item?.product_name ?? item?.name ?? '').trim();
  const retailer = String(item?.retailer ?? item?.merchant ?? item?.store ?? '').trim();
  const url = String(item?.url ?? item?.product_url ?? item?.link ?? '').trim();
  const packQuantity = Number(item?.packQuantity ?? item?.pack_quantity ?? item?.quantity_per_pack ?? item?.unitsPerPack);
  const shipping = Number(item?.shipping ?? item?.shipping_cost ?? item?.delivery ?? item?.delivery_cost);
  const tax = Number(item?.tax ?? item?.tax_amount ?? item?.vat);
  if (!name || !retailer || !url || !Number.isFinite(price) || price < 0) return null;
  return {
    productName: name,
    retailer,
    url,
    price,
    currency: String(item?.currency ?? 'GBP').toUpperCase(),
    unit: item?.unit ? String(item.unit).trim() : undefined,
    packQuantity: Number.isFinite(packQuantity) && packQuantity > 0 ? packQuantity : undefined,
    shipping: Number.isFinite(shipping) && shipping >= 0 ? shipping : undefined,
    tax: Number.isFinite(tax) && tax >= 0 ? tax : undefined,
    totalWithExtras: Number.isFinite(shipping) && shipping >= 0 || Number.isFinite(tax) && tax >= 0 ? price + (Number.isFinite(shipping) && shipping >= 0 ? shipping : 0) + (Number.isFinite(tax) && tax >= 0 ? tax : 0) : undefined,
    observedAt: String(item?.observedAt ?? item?.observed_at ?? item?.checkedAt ?? new Date().toISOString()),
    sourceType: ['retailer_api','merchant_feed','approved_aggregator'].includes(item?.sourceType) ? item.sourceType : 'approved_aggregator',
    confidence: ['high','medium','low'].includes(item?.confidence) ? item.confidence : 'medium',
    availability: item?.in_stock === true || item?.inStock === true ? 'in_stock' : item?.in_stock === false || item?.inStock === false ? 'out_of_stock' : item?.availability === 'in_stock' || item?.availability === 'out_of_stock' ? item.availability : 'unknown',
  };
}

function productSpecKey(name: string) {
  const normalized = name.toLowerCase().replace(/×/g, 'x').replace(/\s+/g, ' ').trim();
  // Preserve explicit dimensions/weights/volumes so similarly named but differently
  // sized products are never treated as the same comparison group.
  const specs = normalized.match(/\b\d+(?:\.\d+)?\s*(?:mm|cm|m|kg|g|l|ml|in|inch|inches|ft|\")\b(?:\s*x\s*\d+(?:\.\d+)?\s*(?:mm|cm|m|kg|g|l|ml|in|inch|inches|ft|\")\b)*/g) || [];
  return specs.map((x) => x.replace(/\s+/g, '')).join('|');
}

function keyFor(item: PriceQuote) {
  const name = item.productName.trim().toLowerCase().replace(/\s+/g, ' ');
  const specs = productSpecKey(name);
  return name + '|' + (item.unit || '').trim().toLowerCase() + '|' + specs;
}

function specsMatch(a: PriceQuote, b: PriceQuote) {
  const aSpecs = productSpecKey(a.productName);
  const bSpecs = productSpecKey(b.productName);
  return aSpecs === bSpecs;
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
    const specGroups = offers.reduce((map, offer) => {
      const key = productSpecKey(offer.productName);
      const list = map.get(key) || [];
      list.push(offer);
      map.set(key, list);
      return map;
    }, new Map<string, PriceQuote[]>());
    const bestSpecGroup = Array.from(specGroups.values()).sort((a, b) => b.length - a.length)[0] || offers;
    offers = bestSpecGroup;
    const currencies = new Set(offers.map((x) => x.currency));
    const units = new Set(offers.map((x) => (x.unit || '').trim().toLowerCase()));
    const normalizedRequiredUnit = requiredUnit?.trim().toLowerCase();
    if (currencies.size !== 1 || units.size !== 1 || (normalizedRequiredUnit && !units.has(normalizedRequiredUnit))) {
      return { productName: offers[0].productName, comparable: false, reason: 'Offers use different currencies, units, or requested units, so QUVOTO will not rank them as directly comparable.', offers };
    }

    const projectQuantity = requiredQuantity && requiredQuantity > 0 ? requiredQuantity : undefined;
    const purchaseCost = (offer: PriceQuote) => {
      if (projectQuantity && offer.packQuantity && offer.unit) {
        return Math.ceil(projectQuantity / offer.packQuantity) * offer.price;
      }
      return offer.price;
    };

    // When the user gives a project quantity, compare the actual number of packs
    // required to complete the job—not just the sticker price of one pack.
    const pricedOffers = offers.map((offer) => {
      const purchasePackCount = projectQuantity && offer.packQuantity && offer.unit
        ? Math.ceil(projectQuantity / offer.packQuantity)
        : undefined;
      const purchaseTotal = purchasePackCount !== undefined
        ? purchasePackCount * offer.price
        : undefined;
      const effectiveUnitPrice = purchaseTotal !== undefined && projectQuantity
        ? purchaseTotal / projectQuantity
        : undefined;
      const totalWithExtras = purchaseTotal !== undefined && (offer.shipping !== undefined || offer.tax !== undefined)
        ? purchaseTotal + (offer.shipping ?? 0) + (offer.tax ?? 0)
        : undefined;
      return { ...offer, purchaseTotal, purchasePackCount, effectiveUnitPrice, totalWithExtras };
    });

    const sorted = [...pricedOffers].sort((a, b) => {
      const stockRank = (a.availability === 'in_stock' ? 0 : a.availability === 'unknown' ? 1 : 2) - (b.availability === 'in_stock' ? 0 : b.availability === 'unknown' ? 1 : 2);
      return stockRank || purchaseCost(a) - purchaseCost(b) || a.price - b.price;
    });
    const purchasable = sorted.filter((offer) => offer.availability !== 'out_of_stock');
    const lowest = purchasable[0] || sorted[0];
    const highest = sorted[sorted.length - 1];
    const average = sorted.reduce((sum, item) => sum + item.price, 0) / sorted.length;
    const spreadPercent = lowest.price > 0 ? ((highest.price - lowest.price) / lowest.price) * 100 : undefined;
    const lowestPackCount = lowest.purchasePackCount;
    const lowestPurchaseTotal = lowest.purchaseTotal;
    const requestedPurchaseTotals = projectQuantity
      ? pricedOffers.filter((offer) => offer.purchaseTotal !== undefined).map((offer) => ({ retailer: offer.retailer, packs: offer.purchasePackCount || 0, total: offer.purchaseTotal || 0, currency: offer.currency, availability: offer.availability || 'unknown' }))
      : undefined;
    const unavailableOffers = pricedOffers.filter((offer) => offer.availability === 'out_of_stock').map((offer) => ({ retailer: offer.retailer, reason: 'Source reports the product as out of stock.' }));

    return { productName: lowest.productName, comparable: sorted.length >= 2, currency: lowest.currency, unit: lowest.unit, requiredQuantity, requiredUnit, offers: sorted, lowest, highest, average, spreadPercent, lowestPurchaseTotal, lowestPackCount, requestedPurchaseTotals, unavailableOffers };
  });
}

export async function getBuildWatchPriceHistory(query: string, days = 30): Promise<PriceHistorySummary | null> {
  const search = await fetchBuildWatch(`/search?q=${encodeURIComponent(query)}`);
  const result = Array.isArray(search?.results) ? search.results[0] : null;
  if (!result?.slug) return null;
  const data = await fetchBuildWatch(`/products/${encodeURIComponent(result.slug)}/prices`);
  const history = Array.isArray(data?.history) ? data.history : [];
  const cutoff = Date.now() - days * 86400000;

  const points = history.filter((x: any) => {
    const timestamp = new Date(x?.scraped_at || 0).getTime();
    return timestamp >= cutoff && Number.isFinite(Number(x?.price_inc_vat));
  }).map((x: any) => ({
    date: String(x.scraped_at),
    retailer: String(x.merchant_name || 'Unknown retailer'),
    price: Number(x.price_inc_vat),
    currency: String(x.currency || 'GBP').toUpperCase(),
    inStock: typeof x.in_stock === 'boolean' ? x.in_stock : undefined,
  })).sort((a: PriceHistoryPoint,b: PriceHistoryPoint) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (!points.length) return null;

  // Compare like-for-like within the same retailer so a retailer switch
  // cannot be mistaken for a price increase/decrease.
  const byRetailer = new Map<string, PriceHistoryPoint[]>();
  for (const point of points) {
    const list = byRetailer.get(point.retailer) || [];
    list.push(point);
    byRetailer.set(point.retailer, list);
  }

  const retailerSignals = Array.from(byRetailer.entries()).map(([retailer, items]) => {
    const first = items[0];
    const latest = items[items.length - 1];
    const changePercent = first.price > 0 ? ((latest.price - first.price) / first.price) * 100 : undefined;
    return { retailer, first, latest, changePercent };
  }).filter((x) => x.changePercent !== undefined);

  const current = points[points.length - 1].price;
  const currency = points[points.length - 1].currency;
  const comparableSignals = retailerSignals.filter((x) => x.latest.currency === currency);
  const averageChange = comparableSignals.length
    ? comparableSignals.reduce((sum, x) => sum + (x.changePercent || 0), 0) / comparableSignals.length
    : undefined;

  const historicalPrices = points.map((point) => point.price).filter((price) => Number.isFinite(price));
  const averagePrice = historicalPrices.length ? historicalPrices.reduce((sum, price) => sum + price, 0) / historicalPrices.length : undefined;
  const lowestPrice = historicalPrices.length ? Math.min(...historicalPrices) : undefined;
  const highestPrice = historicalPrices.length ? Math.max(...historicalPrices) : undefined;
  const direction = averageChange === undefined
    ? 'unknown'
    : averageChange > 0.05 ? 'up'
    : averageChange < -0.05 ? 'down'
    : 'flat';
  const anomaly = current === undefined || averagePrice === undefined
    ? 'unknown'
    : current > averagePrice * 1.10 ? 'high'
    : current < averagePrice * 0.90 ? 'low'
    : 'normal';

  return {
    productName: String(result.name || query),
    currency,
    points: points.slice(-60),
    current,
    previous: points.length > 1 ? points[points.length - 2].price : undefined,
    changePercent: averageChange,
    direction,
    anomaly,
    averagePrice,
    lowestPrice,
    highestPrice,
    source: 'BuildWatch',
  };
}

export async function searchProductPrices(query: string, market: string, currency: string): Promise<PriceQuote[]> {
  const endpoint = process.env.PRICE_INTELLIGENCE_API_URL;
  const isUk = /^(united kingdom|uk|great britain)$/i.test(market.trim());
  if (!endpoint) return isUk ? searchBuildWatchPrices(query) : [];
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (process.env.PRICE_INTELLIGENCE_API_KEY) headers.Authorization = 'Bearer ' + process.env.PRICE_INTELLIGENCE_API_KEY;
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, market, currency, limit: 8 }), cache: 'no-store' });
  if (!response.ok) throw new Error('The connected price intelligence provider returned an error.');
  const payload = await response.json() as ProviderPayload | unknown[];
  const raw = Array.isArray(payload) ? payload : payload?.prices ?? payload?.data ?? payload?.results ?? [];
  return raw.map(normalize).filter((x): x is PriceQuote => Boolean(x)).slice(0, 8);
}

export const PRICE_INTELLIGENCE_CONFIGURED = Boolean(process.env.PRICE_INTELLIGENCE_API_URL);
