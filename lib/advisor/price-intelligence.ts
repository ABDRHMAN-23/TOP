export type PriceQuote = {
  productName: string;
  retailer: string;
  url: string;
  price: number;
  currency: string;
  unit?: string;
  packQuantity?: number;
  packCoverage?: number;
  packCoverageUnit?: string;
  purchaseTotal?: number;
  purchasePackCount?: number;
  effectiveUnitPrice?: number;
  shipping?: number;
  shippingScope?: 'order' | 'pack' | 'unknown';
  tax?: number;
  taxIncluded?: boolean;
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

function normalizeUnit(value?: string): string | undefined {
  const unit = value?.trim().toLowerCase();
  if (!unit) return undefined;
  if (/\b(m|metre|metres|meter|meters)\b/.test(unit)) return 'm';
  if (/\b(kg|kilogram|kilograms)\b/.test(unit)) return 'kg';
  if (/\b(l|litre|litres|liter|liters)\b/.test(unit)) return 'l';
  if (/\b(pc|pcs|piece|pieces|unit|units)\b/.test(unit)) return 'pcs';
  return unit;
}

function parsePackDetails(unitLabel?: string, productName?: string): { quantity?: number; coverage?: number; coverageUnit?: string } {
  const text = `${unitLabel || ''} ${productName || ''}`.toLowerCase().replace(/×/g, 'x');
  const normalizedUnit = normalizeUnit(unitLabel);

  // Examples: "10 x 3m", "10x3m", "10 x 3 m roll".
  // The first number is the count of pieces and the second is the coverage of each piece.
  const multiplied = text.match(/(?:^|\s|\b)(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(m|metres?|meters?|kg|kilograms?|l|litres?|liters?|pcs?|pieces?|units?)\b/i);
  if (multiplied) {
    const count = Number(multiplied[1]);
    const perUnit = Number(multiplied[2]);
    const coverageUnit = normalizeUnit(multiplied[3]);
    if (Number.isFinite(count) && count > 0 && Number.isFinite(perUnit) && perUnit > 0 && coverageUnit) {
      return { quantity: count, coverage: count * perUnit, coverageUnit };
    }
  }

  const explicitPack = text.match(/(?:pack|box|roll|coil|bundle|reel)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(m|metres?|meters?|kg|kilograms?|l|litres?|liters?|pcs?|pieces?|units?)\b/i)
    || text.match(/(\d+(?:\.\d+)?)\s*(m|metres?|meters?|kg|kilograms?|l|litres?|liters?)\s*(?:roll|coil|reel|pack|box|bundle)\b/i);
  if (explicitPack) {
    const value = Number(explicitPack[1]);
    const coverageUnit = normalizeUnit(explicitPack[2]);
    if (Number.isFinite(value) && value > 0 && coverageUnit) {
      return { coverage: value, coverageUnit };
    }
  }

  const quantityOnly = text.match(/(?:pack|box|bundle)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(pcs?|pieces?|units?)\b/i);
  if (quantityOnly) {
    const value = Number(quantityOnly[1]);
    if (Number.isFinite(value) && value > 0) return { quantity: value, coverage: value, coverageUnit: 'pcs' };
  }

  return normalizedUnit ? {} : {};
}

function parsePackQuantity(unitLabel?: string, productName?: string): number | undefined {
  return parsePackDetails(unitLabel, productName).coverage;
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
  const matched = required.filter((spec) => {
    if (actual.has(spec)) return true;
    const match = spec.match(/^(\\d+(?:\\.\\d+)?)(m|kg|l)$/);
    if (!match) return false;
    const requiredValue = Number(match[1]);
    const requiredUnit = match[2];
    const pack = parsePackDetails(undefined, productName);
    return pack.coverageUnit === requiredUnit && pack.coverage !== undefined && Math.abs(pack.coverage - requiredValue) < 0.000001;
  }).length;
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
      const packDetails = parsePackDetails(unit, productName);
      collected.push({
        productName,
        retailer: String(offer?.merchant_name || 'BuildWatch merchant').trim(),
        url: String(product?.url || result?.url || `https://buildwatch.dev/products/${encodeURIComponent(result.slug)}`),
        price,
        currency: String(offer?.currency || 'GBP').toUpperCase(),
        unit,
        packQuantity: packDetails.quantity ?? parsePackQuantity(unit, productName),
        packCoverage: packDetails.coverage,
        packCoverageUnit: packDetails.coverageUnit,
        observedAt: String(offer?.scraped_at || new Date().toISOString()),
        sourceType: 'approved_aggregator',
        confidence: 'medium',
        taxIncluded: true,
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
  const rawPackQuantity = Number(item?.packQuantity ?? item?.pack_quantity ?? item?.quantity_per_pack ?? item?.unitsPerPack);
  const rawPackCoverage = Number(item?.packCoverage ?? item?.pack_coverage ?? item?.coverage_per_pack);
  const shipping = Number(item?.shipping ?? item?.shipping_cost ?? item?.delivery ?? item?.delivery_cost);
  const tax = Number(item?.tax ?? item?.tax_amount ?? item?.vat);
  const shippingScope = item?.shipping_scope === 'pack' || item?.shippingScope === 'pack' ? 'pack' : item?.shipping_scope === 'order' || item?.shippingScope === 'order' ? 'order' : 'unknown';
  const taxIncluded = item?.tax_included === true || item?.taxIncluded === true ? true : item?.tax_included === false || item?.taxIncluded === false ? false : undefined;
  if (!name || !retailer || !url || !Number.isFinite(price) || price < 0) return null;
  const parsed = parsePackDetails(item?.unit ? String(item.unit) : undefined, name);
  const packQuantity = Number.isFinite(rawPackQuantity) && rawPackQuantity > 0 ? rawPackQuantity : parsed.quantity;
  const packCoverage = Number.isFinite(rawPackCoverage) && rawPackCoverage > 0 ? rawPackCoverage : parsed.coverage;
  const packCoverageUnit = item?.packCoverageUnit || item?.pack_coverage_unit || parsed.coverageUnit;
  return {
    productName: name,
    retailer,
    url,
    price,
    currency: String(item?.currency ?? 'GBP').toUpperCase(),
    unit: item?.unit ? String(item.unit).trim() : undefined,
    packQuantity,
    packCoverage,
    packCoverageUnit: normalizeUnit(packCoverageUnit),
    shipping: Number.isFinite(shipping) && shipping >= 0 ? shipping : undefined,
    tax: Number.isFinite(tax) && tax >= 0 ? tax : undefined,
    shippingScope,
    taxIncluded,
    totalWithExtras: undefined,
    observedAt: String(item?.observedAt ?? item?.observed_at ?? item?.checkedAt ?? new Date().toISOString()),
    sourceType: ['retailer_api','merchant_feed','approved_aggregator'].includes(item?.sourceType) ? item.sourceType : 'approved_aggregator',
    confidence: ['high','medium','low'].includes(item?.confidence) ? item.confidence : 'medium',
    availability: item?.in_stock === true || item?.inStock === true ? 'in_stock' : item?.in_stock === false || item?.inStock === false ? 'out_of_stock' : item?.availability === 'in_stock' || item?.availability === 'out_of_stock' ? item.availability : 'unknown',
  };
}

function productSpecKey(name: string) {
  const normalized = name.toLowerCase().replace(/×/g, 'x').replace(/\s+/g, ' ').trim();
  const specs = normalized.match(/\b\d+(?:\.\d+)?\s*(?:mm|cm|m|kg|g|l|ml|in|inch|inches|ft|\")\b(?:\s*x\s*\d+(?:\.\d+)?\s*(?:mm|cm|m|kg|g|l|ml|in|inch|inches|ft|\")\b)*/g) || [];
  return specs.map((x) => x.replace(/\s+/g, '')).join('|');
}

function comparisonKey(item: PriceQuote) {
  const normalized = item.productName
    .trim()
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/\b\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*(?:m|metres?|meters?|kg|kilograms?|l|litres?|liters?|pcs?|pieces?|units?)\b/gi, '')
    .replace(/\b(?:pack|box|roll|coil|bundle|reel)\s*(?:of)?\s*\d+(?:\.\d+)?\s*(?:m|metres?|meters?|kg|kilograms?|l|litres?|liters?|pcs?|pieces?|units?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized + '|' + (normalizeUnit(item.unit) || '');
}

function specsMatch(a: PriceQuote, b: PriceQuote) {
  const aSpecs = productSpecKey(a.productName);
  const bSpecs = productSpecKey(b.productName);
  return aSpecs === bSpecs;
}

export type PurchaseRecommendation = {
  retailer: string;
  productName: string;
  url: string;
  reason: string;
  purchaseTotal?: number;
  packCount?: number;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
};

export function getPurchaseRecommendations(comparisons: PriceComparison[]): PurchaseRecommendation[] {
  return comparisons.filter((comparison) => comparison.comparable && comparison.lowest).map((comparison) => {
    const offer = comparison.lowest!;
    const availabilityText = offer.availability === 'in_stock' ? 'reported in stock' : offer.availability === 'unknown' ? 'stock status is unknown' : 'reported out of stock';
    const costText = offer.purchaseTotal !== undefined
      ? `project purchase cost is ${offer.currency} ${offer.purchaseTotal.toFixed(2)}`
      : `listed price is ${offer.currency} ${offer.price.toFixed(2)}`;
    return {
      retailer: offer.retailer,
      productName: offer.productName,
      url: offer.url,
      reason: `Comparable offer with ${availabilityText}; ${costText} for the requested quantity.`,
      purchaseTotal: offer.purchaseTotal,
      packCount: offer.purchasePackCount,
      availability: offer.availability || 'unknown',
      confidence: offer.confidence,
    };
  });
}

export function comparePriceOffers(prices: PriceQuote[], requiredQuantity?: number, requiredUnit?: string): PriceComparison[] {
  const groups = new Map<string, PriceQuote[]>();
  for (const price of prices) {
    const key = comparisonKey(price);
    const list = groups.get(key) || [];
    list.push(price);
    groups.set(key, list);
  }

  return Array.from(groups.values()).map((offers) => {
    // comparisonKey already preserves product-defining specs (for example 22mm)
    // while intentionally removing equivalent pack formats such as 10×3m vs 30m.
    // Do not re-split by the raw product spec string here, or equivalent pack formats
    // would be separated again before purchase-cost normalization.
    const currencies = new Set(offers.map((x) => x.currency));
    const units = new Set(offers.map((x) => normalizeUnit(x.unit) || ''));
    const normalizedRequiredUnit = normalizeUnit(requiredUnit);
    if (currencies.size !== 1 || units.size !== 1 || (normalizedRequiredUnit && !units.has(normalizedRequiredUnit))) {
      return { productName: offers[0].productName, comparable: false, reason: 'Offers use different currencies, units, or requested units, so QUVOTO will not rank them as directly comparable.', offers };
    }

    const projectQuantity = requiredQuantity && requiredQuantity > 0 ? requiredQuantity : undefined;
    const coverageInRequiredUnit = (offer: PriceQuote) => {
      const coverage = offer.packCoverage ?? offer.packQuantity;
      if (!coverage) return undefined;
      const coverageUnit = normalizeUnit(offer.packCoverageUnit || offer.unit);
      if (!normalizedRequiredUnit || !coverageUnit || coverageUnit !== normalizedRequiredUnit) return undefined;
      return coverage;
    };
    const purchaseCost = (offer: PriceQuote) => {
      const coverage = projectQuantity ? coverageInRequiredUnit(offer) : undefined;
      return coverage ? Math.ceil(projectQuantity! / coverage) * offer.price : offer.price;
    };

    const pricedOffers = offers.map((offer) => {
      const coverage = projectQuantity ? coverageInRequiredUnit(offer) : undefined;
      const purchasePackCount = coverage
        ? Math.ceil(projectQuantity! / coverage)
        : undefined;
      const purchaseTotal = purchasePackCount !== undefined
        ? purchasePackCount * offer.price
        : undefined;
      const effectiveUnitPrice = purchaseTotal !== undefined && projectQuantity
        ? purchaseTotal / projectQuantity
        : undefined;
      const shippingCost = purchaseTotal !== undefined && offer.shipping !== undefined && offer.shippingScope !== 'unknown'
        ? offer.shippingScope === 'pack' && purchasePackCount ? offer.shipping * purchasePackCount : offer.shipping
        : undefined;
      const taxCost = purchaseTotal !== undefined && offer.tax !== undefined && offer.taxIncluded === false
        ? offer.tax
        : undefined;
      const totalWithExtras = purchaseTotal !== undefined && (offer.shipping === undefined || offer.shippingScope !== 'unknown') && (shippingCost !== undefined || taxCost !== undefined)
        ? purchaseTotal + (shippingCost ?? 0) + (taxCost ?? 0)
        : undefined;
      return { ...offer, purchaseTotal, purchasePackCount, effectiveUnitPrice, totalWithExtras };
    });

    const purchasable = pricedOffers.filter((offer) => offer.availability !== 'out_of_stock');
    const canCompareConfirmedTotals = purchasable.length >= 2 && purchasable.every((offer) => offer.totalWithExtras !== undefined);
    const calculatedCost = (offer: PriceQuote) => canCompareConfirmedTotals ? offer.totalWithExtras ?? purchaseCost(offer) : purchaseCost(offer);
    const sorted = [...pricedOffers].sort((a, b) => {
      const stockRank = (a.availability === 'in_stock' ? 0 : a.availability === 'unknown' ? 1 : 2) - (b.availability === 'in_stock' ? 0 : b.availability === 'unknown' ? 1 : 2);
      return calculatedCost(a) - calculatedCost(b) || stockRank || a.price - b.price;
    });
    const lowest = [...purchasable].sort((a, b) => calculatedCost(a) - calculatedCost(b) || a.price - b.price)[0] || sorted[0];
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

  const historicalPrices = points.map((point: PriceHistoryPoint) => point.price).filter((price: number) => Number.isFinite(price));
  const averagePrice = historicalPrices.length ? historicalPrices.reduce((sum: number, price: number) => sum + price, 0) / historicalPrices.length : undefined;
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
