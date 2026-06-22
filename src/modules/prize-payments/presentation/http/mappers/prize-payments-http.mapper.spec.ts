import { PrizePaymentsHttpMapper } from './prize-payments-http.mapper';

describe('PrizePaymentsHttpMapper', () => {
  it('maps pay dto into an application command', () => {
    expect(
      PrizePaymentsHttpMapper.toPayCommand(
        {
          resultId: 'result-id',
          saleId: 'sale-id',
        },
        'admin-id',
      ),
    ).toEqual({
      resultId: 'result-id',
      saleId: 'sale-id',
      paidByUserId: 'admin-id',
    });
  });

  it('maps list query into a domain query', () => {
    expect(
      PrizePaymentsHttpMapper.toListQuery({
        resultId: 'result-id',
        saleId: 'sale-id',
        sellerId: 'seller-id',
        paidByUserId: 'admin-id',
        date: '2026-06-22',
        drawCode: '11',
        paidFrom: '2026-06-22',
        paidUntil: '2026-06-22',
        page: 2,
        limit: 10,
        sortBy: 'sellerName',
        sortDirection: 'asc',
      }),
    ).toEqual({
      resultId: 'result-id',
      saleId: 'sale-id',
      sellerId: 'seller-id',
      paidByUserId: 'admin-id',
      date: '2026-06-22',
      drawCode: '11',
      paidFrom: '2026-06-22',
      paidUntil: '2026-06-22',
      page: 2,
      limit: 10,
      sortBy: 'sellerName',
      sortDirection: 'asc',
    });
  });
});
