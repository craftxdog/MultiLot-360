import { ReportsHttpMapper } from './reports-http.mapper';

describe('ReportsHttpMapper', () => {
  it('maps overview query into a domain query', () => {
    expect(
      ReportsHttpMapper.toOverviewQuery({
        dateFrom: '2026-06-22',
        dateUntil: '2026-06-23',
        sellerId: 'seller-id',
        drawCode: '11',
      }),
    ).toEqual({
      dateFrom: '2026-06-22',
      dateUntil: '2026-06-23',
      sellerId: 'seller-id',
      drawCode: '11',
    });
  });

  it('maps seller report query into a domain query', () => {
    expect(
      ReportsHttpMapper.toSellerReportsQuery({
        dateFrom: '2026-06-22',
        dateUntil: '2026-06-23',
        sellerId: 'seller-id',
        drawCode: '11',
        page: 2,
        limit: 10,
        sortBy: 'balanceMiles',
        sortDirection: 'desc',
      }),
    ).toEqual({
      dateFrom: '2026-06-22',
      dateUntil: '2026-06-23',
      sellerId: 'seller-id',
      drawCode: '11',
      page: 2,
      limit: 10,
      sortBy: 'balanceMiles',
      sortDirection: 'desc',
    });
  });
});
