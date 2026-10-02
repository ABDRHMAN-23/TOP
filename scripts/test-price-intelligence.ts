import assert from 'node:assert/strict';
import { comparePriceOffers } from '../lib/advisor/price-intelligence.ts';

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
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
  offer('22mm copper pipe 30m roll', 'B', 75, { packCoverage: 30, packCoverageUnit: 'm', availability: 'out_of_stock' }),
], 30, 'm');
assert.equal(result[0].lowest?.retailer, 'A');
assert.equal(result[0].unavailableOffers?.[0]?.retailer, 'B');

result = comparePriceOffers([
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock', shipping: 10, shippingScope: 'order' }),
  offer('22mm copper pipe 30m roll', 'B', 65, { packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock', shipping: 4, shippingScope: 'order' }),
], 30, 'm');
assert.equal(result[0].lowest?.retailer, 'B');
assert.equal(result[0].lowest?.totalWithExtras, 69);

result = comparePriceOffers([
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock', shipping: 5, shippingScope: 'unknown' }),
  offer('22mm copper pipe 30m roll', 'B', 65, { packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock' }),
], 30, 'm');
assert.equal(result[0].lowest?.retailer, 'A');
assert.equal(result[0].lowest?.totalWithExtras, undefined, 'unknown shipping scope must not become a confirmed total');

result = comparePriceOffers([
  offer('22mm copper pipe 10 x 3m roll', 'A', 60, { packQuantity: 10, packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock', tax: 12, taxIncluded: false }),
  offer('22mm copper pipe 30m roll', 'B', 65, { packCoverage: 30, packCoverageUnit: 'm', availability: 'in_stock', tax: 0, taxIncluded: true }),
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

console.log('Price comparison tests passed.');
