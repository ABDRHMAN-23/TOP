export type MarketIndicator = {
  id: string;
  label: string;
  value: number;
  unit: 'percent_yoy' | 'percent_mom';
  period: string;
  market: 'United Kingdom';
  kind: 'price_index' | 'material_price_change';
  source: string;
  sourceUrl: string;
  publishedAt: string;
  note: string;
};

export const UK_MARKET_DATA: MarketIndicator[] = [
  {
    id: 'all-work-yoy',
    label: 'Construction material price index — all work',
    value: 5.9,
    unit: 'percent_yoy',
    period: 'July 2025 to July 2026',
    market: 'United Kingdom',
    kind: 'price_index',
    source: 'GOV.UK — Building materials and components statistics',
    sourceUrl: 'https://www.gov.uk/government/statistics/building-materials-and-components-statistics-august-2026--2',
    publishedAt: '2026-09-16',
    note: 'Official market index movement; not a retail product price.',
  },
  {
    id: 'all-work-mom',
    label: 'Construction material price index — all work',
    value: 0.4,
    unit: 'percent_mom',
    period: 'June 2026 to July 2026',
    market: 'United Kingdom',
    kind: 'price_index',
    source: 'GOV.UK — Building materials and components statistics',
    sourceUrl: 'https://www.gov.uk/government/statistics/building-materials-and-components-statistics-august-2026--2',
    publishedAt: '2026-09-16',
    note: 'Official market index movement; not a retail product price.',
  },
  {
    id: 'fabricated-structural-steel',
    label: 'Fabricated structural steel',
    value: 20.9,
    unit: 'percent_yoy',
    period: 'July 2025 to July 2026',
    market: 'United Kingdom',
    kind: 'material_price_change',
    source: 'GOV.UK — Building materials and components statistics',
    sourceUrl: 'https://www.gov.uk/government/statistics/building-materials-and-components-statistics-august-2026--2',
    publishedAt: '2026-09-16',
    note: 'Annual percentage change; not a quoted supplier price.',
  },
  {
    id: 'rigid-pipes-fittings',
    label: 'Rigid pipes and fittings',
    value: 15.5,
    unit: 'percent_yoy',
    period: 'July 2025 to July 2026',
    market: 'United Kingdom',
    kind: 'material_price_change',
    source: 'GOV.UK — Building materials and components statistics',
    sourceUrl: 'https://www.gov.uk/government/statistics/building-materials-and-components-statistics-august-2026--2',
    publishedAt: '2026-09-16',
    note: 'Annual percentage change; not a quoted supplier price.',
  },
  {
    id: 'flexible-pipes-fittings',
    label: 'Flexible pipes and fittings',
    value: 11.7,
    unit: 'percent_yoy',
    period: 'July 2025 to July 2026',
    market: 'United Kingdom',
    kind: 'material_price_change',
    source: 'GOV.UK — Building materials and components statistics',
    sourceUrl: 'https://www.gov.uk/government/statistics/building-materials-and-components-statistics-august-2026--2',
    publishedAt: '2026-09-16',
    note: 'Annual percentage change; not a quoted supplier price.',
  },
  {
    id: 'electric-water-heaters',
    label: 'Electric water heaters',
    value: -1.5,
    unit: 'percent_yoy',
    period: 'July 2025 to July 2026',
    market: 'United Kingdom',
    kind: 'material_price_change',
    source: 'GOV.UK — Building materials and components statistics',
    sourceUrl: 'https://www.gov.uk/government/statistics/building-materials-and-components-statistics-august-2026--2',
    publishedAt: '2026-09-16',
    note: 'Annual percentage change; not a quoted supplier price.',
  },
  {
    id: 'cement',
    label: 'Cement',
    value: -3.5,
    unit: 'percent_yoy',
    period: 'July 2025 to July 2026',
    market: 'United Kingdom',
    kind: 'material_price_change',
    source: 'GOV.UK — Building materials and components statistics',
    sourceUrl: 'https://www.gov.uk/government/statistics/building-materials-and-components-statistics-august-2026--2',
    publishedAt: '2026-09-16',
    note: 'Annual percentage change; not a quoted supplier price.',
  },
];

export function findUKMarketData(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return UK_MARKET_DATA;
  const aliases: Record<string, string[]> = {
    steel: ['steel', 'structural'],
    pipe: ['pipe', 'pipes', 'fitting', 'fittings'],
    cement: ['cement'],
    heater: ['heater', 'heaters', 'water heater', 'water heaters'],
    construction: ['construction', 'all work', 'materials'],
  };
  const terms = Object.entries(aliases).find(([key]) => q.includes(key))?.[1] ?? q.split(/\\s+/).filter(Boolean);
  return UK_MARKET_DATA.filter((item) => terms.some((term) => (item.label + ' ' + item.note).toLowerCase().includes(term)));
}
