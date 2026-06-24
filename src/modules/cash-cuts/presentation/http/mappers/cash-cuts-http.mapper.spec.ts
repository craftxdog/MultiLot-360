import { CashCutsHttpMapper } from './cash-cuts-http.mapper';

describe('CashCutsHttpMapper', () => {
  it('maps create dto into an application command', () => {
    expect(
      CashCutsHttpMapper.toCreateCommand(
        {
          startDate: '2026-06-22',
          endDate: '2026-06-23',
          description: 'Daily close',
          visibleToSellers: false,
        },
        'admin-id',
      ),
    ).toEqual({
      startDate: '2026-06-22',
      endDate: '2026-06-23',
      description: 'Daily close',
      visibleToSellers: false,
      createdByUserId: 'admin-id',
    });
  });

  it('maps list query into a domain query', () => {
    expect(
      CashCutsHttpMapper.toListQuery({
        startDate: '2026-06-22',
        endDate: '2026-06-23',
        visibleToSellers: true,
        createdByUserId: 'admin-id',
        page: 2,
        limit: 10,
        sortBy: 'startDate',
        sortDirection: 'asc',
      }),
    ).toEqual({
      startDate: '2026-06-22',
      endDate: '2026-06-23',
      visibleToSellers: true,
      createdByUserId: 'admin-id',
      page: 2,
      limit: 10,
      sortBy: 'startDate',
      sortDirection: 'asc',
    });
  });
});
