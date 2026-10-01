import { NextResponse } from 'next/server';
import { findUKMarketData } from '@/lib/advisor/uk-market-data';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const market = String(body?.market || 'United Kingdom').trim();
    const query = String(body?.query || '').trim();

    if (!/^united kingdom$|^uk$|^great britain$/i.test(market)) {
      return NextResponse.json({
        market,
        data: [],
        message: 'Verified construction-material market data is currently available only for the United Kingdom.',
      });
    }

    const data = findUKMarketData(query);
    return NextResponse.json({
      market: 'United Kingdom',
      query,
      data,
      source: 'GOV.UK — Building materials and components statistics: August 2026',
      sourceUrl: 'https://www.gov.uk/government/statistics/building-materials-and-components-statistics-august-2026--2',
      publishedAt: '2026-09-16',
      dataThrough: '2026-07',
      dataType: 'official market index movements',
      disclaimer: 'These are official market indicators, not live supplier or retail prices. QUVOTO must not present them as individual product quotes.',
    });
  } catch {
    return NextResponse.json({ error: 'Market data request failed.' }, { status: 500 });
  }
}
