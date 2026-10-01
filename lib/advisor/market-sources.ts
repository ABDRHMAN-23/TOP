export type MarketSource = {
  id: string;
  name: string;
  scope: string;
  coverage: string;
  frequency: string;
  kind: 'official' | 'reference';
  url: string;
};

export const MARKET_SOURCES: MarketSource[] = [
  {
    id: 'uk-building-materials',
    name: 'UK Building Materials and Components Statistics',
    scope: 'United Kingdom',
    coverage: 'Construction material price indices and selected materials/components',
    frequency: 'Monthly / quarterly / annual depending on series',
    kind: 'official',
    url: 'https://www.gov.uk/government/statistics/building-materials-and-components-statistics-august-2026--2',
  },
  {
    id: 'uk-construction-opi',
    name: 'UK Construction Output Price Indices',
    scope: 'United Kingdom',
    coverage: 'Construction output price indices for new work and repair/maintenance',
    frequency: 'Monthly index values, published quarterly',
    kind: 'official',
    url: 'https://www.ons.gov.uk/businessindustryandtrade/constructionindustry/methodologies/constructionoutputpriceindicesopisqmi',
  },
  {
    id: 'fx-frankfurter',
    name: 'Frankfurter reference exchange rates',
    scope: 'International',
    coverage: 'Reference FX rates used only for currency conversion context',
    frequency: 'Daily reference data',
    kind: 'reference',
    url: 'https://www.frankfurter.app/',
  },
];

export function sourcesForMarket(market: string) {
  const normalized = market.trim().toLowerCase();
  if (normalized === 'united kingdom' || normalized === 'uk' || normalized === 'great britain') {
    return MARKET_SOURCES;
  }
  return MARKET_SOURCES.filter((source) => source.id === 'fx-frankfurter');
}
