import { ResultsHttpMapper } from './results-http.mapper';

describe('ResultsHttpMapper', () => {
  it('maps create dto into an application command', () => {
    expect(
      ResultsHttpMapper.toCreateCommand(
        {
          shiftId: 'shift-id',
          winningNumber: '20',
        },
        'admin-id',
      ),
    ).toEqual({
      shiftId: 'shift-id',
      winningNumber: '20',
      createdByUserId: 'admin-id',
    });
  });

  it('maps list query into a domain query', () => {
    expect(
      ResultsHttpMapper.toListQuery({
        shiftId: 'shift-id',
        date: '2026-06-22',
        drawCode: '11',
        winningNumber: '20',
        createdByUserId: 'admin-id',
        page: 2,
        limit: 10,
        sortBy: 'date',
        sortDirection: 'asc',
      }),
    ).toEqual({
      shiftId: 'shift-id',
      date: '2026-06-22',
      drawCode: '11',
      winningNumber: '20',
      createdByUserId: 'admin-id',
      page: 2,
      limit: 10,
      sortBy: 'date',
      sortDirection: 'asc',
    });
  });

  it('maps winning sales query into a domain query', () => {
    expect(
      ResultsHttpMapper.toWinningSalesQuery('result-id', {
        sellerId: 'seller-id',
        paid: false,
        page: 1,
        limit: 25,
        sortBy: 'createdAt',
        sortDirection: 'desc',
      }),
    ).toEqual({
      resultId: 'result-id',
      sellerId: 'seller-id',
      paid: false,
      page: 1,
      limit: 25,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });
  });
});
