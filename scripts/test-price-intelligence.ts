import assert from 'node:assert/strict';
import { comparePriceOffers, getPurchaseRecommendations, specMatchScore } from '../lib/advisor/price-intelligence.ts';

const base = {
  currency: 'GBP',
  unit: 'm',
  observedAt: '2026-10-02T00:00:00.000Z',
  sourceType: 'approved_aggregator' as const,
  confidence: 'high' as const,
};

function offer(productName: string, retailer: string, price: number, extra: Partial<typeof base & {
  packQuantity: number;
  packCoverage: number;
  packCoverageUnit: string;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  shipping: number;
  shippingScope: 'order' | 'pack' | 'unknown';
  tax: number;
  taxIncluded: boolean;
}>) {
  return {
    ...base,
    ...extra,
    productName,
    retailer,
    url: `https://example.test/${retailer.toLowerCase()}`,
    price,
  };
}

const common = [
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
  offer('22mm copper pipe 30m roll', 'B', 75, { packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
  offer('22mm copper pipe 3 x 10m', 'C', 66, { packQuantity: 3, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
];

let result = comparePriceOffers(common, 30, 'm');
assert.equal(result.length, 1, 'equivalent pack formats must stay in one comparison');
assert.equal(result[0].comparable, true);
assert.equal(result[0].offers.length, 3);
assert.equal(result[0].lowest?.retailer, 'A');
assert.equal(result[0].lowestPurchaseTotal, 60);
assert.equal(result[0].lowestPackCount, 1);

result = comparePriceOffers([
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
  offer('22mm copper pipe 2 x 15m roll', 'B', 62, { packQuantity: 2, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
], 30, 'm');
assert.equal(result[0].lowest?.retailer, 'A');
assert.equal(result[0].requestedPurchaseTotals?.find(x => x.retailer === 'B')?.total, 62);

result = comparePriceOffers([
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', unit: '30m roll', availability: 'in_stock' }),
  offer('22mm copper pipe 30m roll', 'B', 75, { packCoverage: 30, packCoverageUnit: 'm', unit: '30m roll', availability: 'in_stock' }),
], 30, 'm');
assert.equal(result[0].comparable, true, 'pack coverage unit must support comparable offers even when unit labels contain pack text');
assert.equal(result[0].lowest?.retailer, 'A');

result = comparePriceOffers([
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
  offer('22mm copper pipe 30m roll', 'B', 75, { packCoverage: 30, packCoverageUnit: 'm', availability: 'out_of_stock' }),
], 30, 'm');
assert.equal(result[0].lowest?.retailer, 'A');
assert.equal(result[0].unavailableOffers?.[0]?.retailer, 'B');

result = comparePriceOffers([
  offer('22mm copper pipe 30m roll', 'A', 50, { packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
  offer('22mm copper pipe 30m roll', 'B', 500, { packCoverage: 30, packCoverageUnit: 'm', availability: 'out_of_stock' }),
], 30, 'm');
assert.equal(result[0].spreadPercent, 0, 'out-of-stock offers must not distort the price spread');

result = comparePriceOffers([
  offer('22mm copper pipe 30m roll', 'A', 50, { packCoverage: 30, packCoverageUnit: 'm', availability: 'out_of_stock' }),
  offer('22mm copper pipe 30m roll', 'B', 55, { packCoverage: 30, packCoverageUnit: 'm', availability: 'out_of_stock' }),
], 30, 'm');
assert.equal(result[0].comparable, true);
assert.equal(result[0].lowest, undefined, 'all unavailable offers must not produce a purchasable lowest offer');
assert.equal(getPurchaseRecommendations(result).length, 0, 'all unavailable offers must not produce purchase recommendations');

result = comparePriceOffers([
  offer('22mm copper pipe 30m roll', 'A', 50, { packCoverage: 30, packCoverageUnit: 'm', availability: 'unknown' }),
  offer('22mm copper pipe 30m roll', 'B', 55, { packCoverage: 30, packCoverageUnit: 'm', availability: 'out_of_stock' }),
], 30, 'm');
assert.equal(result[0].lowest?.retailer, 'A');
assert.equal(result[0].lowest?.availability, 'unknown');
assert.equal(getPurchaseRecommendations(result)[0]?.availability, 'unknown');

result = comparePriceOffers([
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock', shipping: 10, shippingScope: 'order' }),
  offer('22mm copper pipe 30m roll', 'B', 65, { packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock', shipping: 4, shippingScope: 'order' }),
], 30, 'm');
assert.equal(result[0].lowest?.retailer, 'B');
assert.equal(result[0].lowest?.totalWithExtras, 69);
assert.equal(result[0].lowestCostBasis, 'confirmed_total');
assert.equal(result[0].lowestTotalWithExtras, 69);
const recommendations = getPurchaseRecommendations(result);
assert.equal(recommendations[0]?.costBasis, 'confirmed_total');
assert.equal(recommendations[0]?.totalWithExtras, 69);

result = comparePriceOffers([
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock', shipping: 5, shippingScope: 'unknown' }),
  offer('22mm copper pipe 30m roll', 'B', 65, { packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
], 30, 'm');
assert.equal(result[0].lowest?.retailer, 'A');
assert.equal(result[0].lowest?.totalWithExtras, undefined, 'unknown shipping scope must not become a confirmed total');

result = comparePriceOffers([
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock', shipping: 0, shippingScope: 'order', tax: 12, taxIncluded: false }),
  offer('22mm copper pipe 30m roll', 'B', 65, { packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock', shipping: 0, shippingScope: 'order', tax: 0, taxIncluded: true }),
], 30, 'm');
assert.equal(result[0].lowest?.retailer, 'B');
assert.equal(result[0].lowest?.totalWithExtras, 65);

result = comparePriceOffers([
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
  offer('22mm copper pipe 15m roll', 'B', 35, { packCoverage: 15, packCoverageUnit: 'm', availability: 'in_stock' }),
], 30, 'm');
assert.equal(result[0].requestedPurchaseTotals?.find(x => x.retailer === 'B')?.total, 70);

result = comparePriceOffers([
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
  offer('22mm copper pipe 30m roll', 'B', 75, { packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock', currency: 'USD' }),
], 30, 'm');
assert.equal(result[0].comparable, false, 'different currencies must not be ranked together');

assert.equal(specMatchScore('22mm copper pipe', '22mm copper pipe 30m roll'), 1);
assert.equal(specMatchScore('22mm copper pipe', '28mm copper pipe 30m roll'), 0);
assert.equal(specMatchScore('30m 22mm copper pipe', '22mm copper pipe 10 x 3m roll'), 1);
assert.equal(specMatchScore('30m 22mm copper pipe', '22mm copper pipe 2 x 15m roll'), 1);
assert.equal(specMatchScore('15kg cement', '20kg cement bag'), 0);
assert.equal(specMatchScore('15kg cement', 'cement 3 x 5kg bags'), 1);

// Price-history semantics are currency-safe by construction: comparison metrics use only the latest observation currency.

console.log('Price comparison tests passed.');
